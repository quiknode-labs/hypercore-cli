import { getSavedToken } from './keychain';
import { getSavedWalletKey } from './wallet-keychain';
import { readSavedConfig, type SavedConfig } from './storage';
import { promptAdapter, type PromptAdapter } from '../utils/prompt';
import type { ConnectionMode, ResolvedCredentials } from '../types/common';
import { isInteractive, selectPrompt, type SelectPromptConfig } from '../utils/interactive';
import { extractTokenFromEndpoint, QUICKNODE_WSS_EXAMPLE } from '../utils/url';
import { X402_DEFAULT_BASE_URL, X402_DEFAULT_NETWORK } from '../x402/constants';

const ENDPOINT_PROMPT =
  `Quicknode endpoint (host or full WSS URL, e.g. ${QUICKNODE_WSS_EXAMPLE}): `;

export interface ResolveCredentialInput {
  endpointFlag?: string;
  tokenFlag?: string;
  promptOnMissing?: boolean;
  prompt?: PromptAdapter;
  isInteractiveFn?: () => boolean;
  selectModePromptFn?: (config: SelectPromptConfig<ConnectionMode>) => Promise<ConnectionMode>;
  env?: Record<string, string | undefined>;
  readSavedConfigFn?: () => Promise<SavedConfig>;
  getSavedTokenFn?: () => Promise<string | null>;
  modeFlag?: string;
  walletKeyFlag?: string;
  x402BaseUrlFlag?: string;
  getSavedWalletKeyFn?: () => Promise<string | null>;
}

export async function resolveCredentials(
  input: ResolveCredentialInput,
): Promise<ResolvedCredentials> {
  const environment = input.env ?? process.env;
  const readSavedConfigFn = input.readSavedConfigFn ?? readSavedConfig;
  const getSavedTokenFn = input.getSavedTokenFn ?? getSavedToken;
  const getSavedWalletKeyFn = input.getSavedWalletKeyFn ?? getSavedWalletKey;
  const isInteractiveFn = input.isInteractiveFn ?? isInteractive;
  const selectModePromptFn = input.selectModePromptFn ?? selectPrompt;
  const savedConfig = await readSavedConfigFn();
  const savedToken = await getSavedTokenFn();
  const savedWalletKey = await getSavedWalletKeyFn();
  const prompt = input.prompt ?? promptAdapter;

  // Resolve endpoint (QN mode)
  let endpointSource: ResolvedCredentials['endpointSource'];
  let endpoint = input.endpointFlag?.trim();
  if (endpoint) {
    endpointSource = 'flag';
  } else if (environment.QUICKNODE_ENDPOINT?.trim()) {
    endpoint = environment.QUICKNODE_ENDPOINT.trim();
    endpointSource = 'env';
  } else if (savedConfig.endpoint?.trim()) {
    endpoint = savedConfig.endpoint.trim();
    endpointSource = 'saved';
  } else {
    endpoint = undefined;
    endpointSource = 'prompt';
  }

  // Resolve token (QN mode)
  let tokenSource: ResolvedCredentials['tokenSource'];
  let token = input.tokenFlag?.trim();
  if (token) {
    tokenSource = 'flag';
  } else if (environment.QUICKNODE_TOKEN?.trim()) {
    token = environment.QUICKNODE_TOKEN.trim();
    tokenSource = 'env';
  } else if (savedToken?.trim()) {
    token = savedToken.trim();
    tokenSource = 'saved';
  } else {
    token = undefined;
    tokenSource = 'prompt';
  }

  const endpointToken = endpoint ? extractTokenFromEndpoint(endpoint) : null;
  const tokenIsExplicit = tokenSource === 'flag' || tokenSource === 'env';
  if (endpointToken && (!token || !tokenIsExplicit)) {
    token = endpointToken;
    tokenSource = 'endpoint';
  }

  // Resolve wallet key (x402 mode)
  let walletKey = input.walletKeyFlag?.trim();
  if (!walletKey && environment.X402_WALLET_KEY?.trim()) {
    walletKey = environment.X402_WALLET_KEY.trim();
  }
  if (!walletKey && savedWalletKey?.trim()) {
    walletKey = savedWalletKey.trim();
  }

  // Resolve mode: flag → env → saved → auto-detect
  let mode: ConnectionMode;
  const explicitModeInput = input.modeFlag?.trim() ?? environment.X402_MODE?.trim();
  const savedModeInput = savedConfig.mode;
  if (explicitModeInput === 'x402' || explicitModeInput === 'quicknode') {
    mode = explicitModeInput;
  } else if (savedModeInput === 'x402' || savedModeInput === 'quicknode') {
    mode = savedModeInput;
  } else if (walletKey && !endpoint) {
    mode = 'x402';
  } else if (endpoint) {
    mode = 'quicknode';
  } else if (walletKey) {
    mode = 'x402';
  } else {
    mode = 'quicknode';
  }

  const shouldPromptForMode = (
    input.promptOnMissing !== false &&
    isInteractiveFn() &&
    !explicitModeInput &&
    !savedModeInput &&
    Boolean(endpoint) &&
    Boolean(walletKey)
  );
  if (shouldPromptForMode) {
    mode = await promptConnectionMode(selectModePromptFn, mode);
  }

  if (mode === 'x402') {
    // Resolve x402-specific fields
    const x402BaseUrl =
      input.x402BaseUrlFlag?.trim() ??
      environment.X402_BASE_URL?.trim() ??
      savedConfig.x402BaseUrl ??
      X402_DEFAULT_BASE_URL;

    const x402Network = savedConfig.x402Network ?? X402_DEFAULT_NETWORK;
    const x402Chain = savedConfig.x402Chain ?? 'base-sepolia';

    if (input.promptOnMissing !== false && !walletKey) {
      process.stdout.write('Note: Private key must include the 0x prefix (e.g. 0x1234...abcd)\n');
      walletKey = await prompt.ask('Wallet private key (for x402 payments): ', { secret: true });
    }

    if (!walletKey) {
      throw new Error(
        'Missing wallet key for x402 mode. Provide --wallet-key, X402_WALLET_KEY env var, or run `hypercore-cli config`.',
      );
    }

    return {
      mode,
      endpoint,
      token,
      endpointSource,
      tokenSource,
      walletKey,
      x402BaseUrl,
      x402Network,
      x402Chain,
    };
  }

  // quicknode mode
  if (input.promptOnMissing !== false) {
    if (!endpoint) {
      endpoint = await prompt.ask(ENDPOINT_PROMPT, { secret: true });
      endpointSource = 'prompt';
    }
    if (!token) {
      token = await prompt.ask('Quicknode API token: ', { secret: true });
      tokenSource = 'prompt';
    }
  }

  if (!endpoint || !token) {
    throw new Error(
      'Missing Quicknode credentials. Provide --endpoint/--token, env vars, saved config, or run `hypercore-cli config`.',
    );
  }

  return {
    mode,
    endpoint,
    token,
    endpointSource,
    tokenSource,
  };
}

async function promptConnectionMode(
  selectModePromptFn: (config: SelectPromptConfig<ConnectionMode>) => Promise<ConnectionMode>,
  defaultMode: ConnectionMode,
): Promise<ConnectionMode> {
  const options = defaultMode === 'quicknode'
    ? [
        {
          value: 'quicknode' as const,
          label: 'quicknode',
          description: 'Quicknode endpoint/token (all datasets + gRPC)',
        },
        {
          value: 'x402' as const,
          label: 'x402',
          description: 'Wallet-based micropayments (blocks & gRPC not yet supported)',
        },
      ]
    : [
        {
          value: 'x402' as const,
          label: 'x402',
          description: 'Wallet-based micropayments (blocks & gRPC not yet supported)',
        },
        {
          value: 'quicknode' as const,
          label: 'quicknode',
          description: 'Quicknode endpoint/token (all datasets + gRPC)',
        },
      ];

  return selectModePromptFn({
    message: 'Select connection mode',
    options,
  });
}

export function maskToken(token: string | null): string {
  if (!token) {
    return '(not set)';
  }
  if (token.length <= 8) {
    return '****';
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
