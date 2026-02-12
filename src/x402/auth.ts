import { privateKeyToAccount } from 'viem/accounts';
import { SiweMessage } from 'siwe';
import crypto from 'node:crypto';

export interface X402AuthManager {
  getValidJwt(): Promise<string>;
  getWalletAddress(): string;
  getBaseUrl(): string;
  invalidate(): void;
}

interface AuthResponse {
  token: string;
  expiresAt?: number;
}

export function createX402AuthManager(config: {
  privateKey: string;
  baseUrl: string;
  chainId: number;
}): X402AuthManager {
  const account = privateKeyToAccount(config.privateKey as `0x${string}`);

  let cachedJwt: string | null = null;
  let cachedExpiresAt = 0;
  let refreshPromise: Promise<string> | null = null;

  async function authenticate(): Promise<string> {
    const domain = new URL(config.baseUrl).host;
    const nonce = crypto.randomBytes(8).toString('hex');
    const issuedAt = new Date().toISOString();

    const message = new SiweMessage({
      domain,
      address: account.address,
      statement: 'I accept the Quicknode Terms of Service: https://www.quicknode.com/terms',
      uri: config.baseUrl,
      version: '1',
      chainId: config.chainId,
      nonce,
      issuedAt,
    });

    const messageText = message.prepareMessage();
    const signature = await account.signMessage({ message: messageText });

    const response = await fetch(`${config.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText, signature }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`x402 auth failed (HTTP ${response.status}): ${body}`);
    }

    const data = (await response.json()) as AuthResponse;
    cachedJwt = data.token;

    if (data.expiresAt) {
      cachedExpiresAt = data.expiresAt;
    } else {
      // Decode JWT to get expiry
      try {
        const payload = JSON.parse(
          Buffer.from(data.token.split('.')[1]!, 'base64url').toString('utf8'),
        ) as { exp?: number };
        cachedExpiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 3600_000;
      } catch {
        cachedExpiresAt = Date.now() + 3600_000;
      }
    }

    return cachedJwt;
  }

  return {
    async getValidJwt(): Promise<string> {
      const needsRefresh = !cachedJwt || Date.now() >= cachedExpiresAt - 60_000;
      if (!needsRefresh) {
        return cachedJwt!;
      }

      if (refreshPromise) {
        return refreshPromise;
      }

      refreshPromise = authenticate().finally(() => {
        refreshPromise = null;
      });
      return refreshPromise;
    },

    getWalletAddress(): string {
      return account.address;
    },

    getBaseUrl(): string {
      return config.baseUrl;
    },

    invalidate(): void {
      cachedJwt = null;
      cachedExpiresAt = 0;
    },
  };
}
