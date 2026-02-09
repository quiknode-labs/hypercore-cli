import type { ConnectionMode, ResolvedCredentials } from '../types/common';
import { deriveEndpointUrls } from '../utils/url';
import { createX402AuthManager } from './auth';
import { createX402Fetch } from './fetch-wrapper';
import { X402_CHAIN_IDS } from './constants';
import { fetchX402Credits } from './credits';

export interface ConnectionContext {
  mode: ConnectionMode;
  wsUrl: string;
  httpUrl: string;
  fetchFn: typeof fetch;
  sensitiveTokens: string[];
  refreshWsUrl?: () => Promise<string>;
  ensureCredits?: () => Promise<void>;
  getCredits?: () => Promise<number>;
  initialCredits?: number;
  getPurchasedCredits?: () => number;
  cleanup?: () => void;
}

export async function createConnection(
  credentials: ResolvedCredentials,
  logger: { info(msg: string): void; warn(msg: string): void },
): Promise<ConnectionContext> {
  if (credentials.mode === 'x402') {
    return createX402Connection(credentials, logger);
  }
  return createQuicknodeConnection(credentials);
}

function createQuicknodeConnection(credentials: ResolvedCredentials): ConnectionContext {
  const urls = deriveEndpointUrls(credentials.endpoint!, credentials.token);
  return {
    mode: 'quicknode',
    wsUrl: urls.wsUrl,
    httpUrl: urls.httpUrl,
    fetchFn: fetch,
    sensitiveTokens: credentials.token ? [credentials.token] : [],
  };
}

async function createX402Connection(
  credentials: ResolvedCredentials,
  logger: { info(msg: string): void; warn(msg: string): void },
): Promise<ConnectionContext> {
  const walletKey = credentials.walletKey!;
  const baseUrl = credentials.x402BaseUrl!;
  const network = credentials.x402Network!;
  const chain = credentials.x402Chain ?? 'base-sepolia';
  const chainId = X402_CHAIN_IDS[chain] ?? X402_CHAIN_IDS['base-sepolia']!;

  const authManager = createX402AuthManager({
    privateKey: walletKey,
    baseUrl,
    chainId,
  });
  let totalPurchasedCredits = 0;

  const getCredits = async (): Promise<number> => {
    try {
      const data = await fetchX402Credits(authManager);
      return data.credits;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(message);
      return -1;
    }
  };

  logger.info(`Authenticating with x402 (wallet: ${authManager.getWalletAddress()}, chain: ${chain})`);
  await authManager.getValidJwt();
  logger.info('x402 authentication successful');

  const fetchFn = createX402Fetch({
    authManager,
    privateKey: walletKey,
  });

  const httpUrl = `${baseUrl}/${network}`;
  const buildWsUrl = async (): Promise<string> => {
    const token = await authManager.getValidJwt();
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const host = new URL(baseUrl).host;
    return `${wsProtocol}://${host}/${network}/ws?token=${token}`;
  };

  // Proactively acquire credits before WS connect (WS upgrades can't trigger x402 payment)
  const acquireCredits = async (): Promise<number> => {
    const credits = await getCredits();
    logger.info(`x402 credits: ${credits}`);
    if (credits > 0) {
      return credits;
    }
    logger.info('No x402 credits, making paid HTTP request to acquire credits...');
    const paymentResponse = await fetchFn(httpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}',
    });
    const paymentBody = await paymentResponse.text().catch(() => '');
    const paymentHeader = paymentResponse.headers.get('PAYMENT-RESPONSE');
    logger.info(`Payment HTTP ${paymentResponse.status}: ${paymentBody}`);
    if (paymentHeader) {
      logger.info(`PAYMENT-RESPONSE: ${paymentHeader}`);
    }
    if (!paymentResponse.ok) {
      logger.warn(`Paid HTTP request failed (HTTP ${paymentResponse.status})`);
    }
    const newCredits = await getCredits();
    logger.info(`x402 credits after payment: ${newCredits}`);
    if (credits >= 0 && newCredits > credits) {
      const acquired = newCredits - credits;
      totalPurchasedCredits += acquired;
      logger.info(`x402 credit top-up: +${acquired}`);
    }
    if (newCredits <= 0) {
      throw new Error('Failed to acquire x402 credits after payment');
    }
    return newCredits;
  };

  const initialCredits = await acquireCredits();

  return {
    mode: 'x402',
    wsUrl: await buildWsUrl(),
    httpUrl,
    fetchFn,
    sensitiveTokens: [walletKey],
    refreshWsUrl: buildWsUrl,
    ensureCredits: async () => {
      await acquireCredits();
    },
    getCredits,
    initialCredits,
    getPurchasedCredits: () => totalPurchasedCredits,
    cleanup: () => {
      authManager.invalidate();
    },
  };
}
