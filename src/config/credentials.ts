import { getSavedToken } from './keychain';
import { readSavedConfig, type SavedConfig } from './storage';
import { promptAdapter, type PromptAdapter } from '../utils/prompt';
import type { ResolvedCredentials } from '../types/common';
import { extractTokenFromEndpoint } from '../utils/url';

export interface ResolveCredentialInput {
  endpointFlag?: string;
  tokenFlag?: string;
  promptOnMissing?: boolean;
  prompt?: PromptAdapter;
  env?: Record<string, string | undefined>;
  readSavedConfigFn?: () => Promise<SavedConfig>;
  getSavedTokenFn?: () => Promise<string | null>;
}

export async function resolveCredentials(
  input: ResolveCredentialInput,
): Promise<ResolvedCredentials> {
  const environment = input.env ?? process.env;
  const readSavedConfigFn = input.readSavedConfigFn ?? readSavedConfig;
  const getSavedTokenFn = input.getSavedTokenFn ?? getSavedToken;
  const savedConfig = await readSavedConfigFn();
  const savedToken = await getSavedTokenFn();
  const prompt = input.prompt ?? promptAdapter;

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

  if (input.promptOnMissing !== false) {
    if (!endpoint) {
      endpoint = await prompt.ask(
        'Quicknode endpoint (recommended full WSS URL ending with /hypercore/ws): ',
      );
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
    endpoint,
    token,
    endpointSource,
    tokenSource,
  };
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
