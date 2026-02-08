export interface EndpointUrls {
  wsUrl: string;
  httpUrl: string;
}

const REDACTED_VALUE = 'REDACTED';
const SENSITIVE_QUERY_KEY_PATTERN = /(token|api[_-]?key|authorization)/i;
export const QUICKNODE_WSS_EXAMPLE =
  'wss://YOUR_ENDPOINT_NAME.hype-mainnet.quiknode.pro/YOUR_TOKEN/hypercore/ws';

export function deriveEndpointUrls(endpointInput: string, tokenInput?: string): EndpointUrls {
  const endpoint = endpointInput.trim();
  const tokenFromEndpoint = extractTokenFromEndpoint(endpoint);
  const token = tokenInput?.trim() || tokenFromEndpoint;

  if (looksLikeUrl(endpoint)) {
    const parsed = new URL(endpoint);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol === 'wss:' || protocol === 'ws:') {
      if (hasHypercoreWsPath(parsed.pathname)) {
        const wsUrl = `${protocol}//${parsed.host}${normalizePath(parsed.pathname)}`;
        const endpointToken = extractTokenFromPath(parsed.pathname) ?? token;
        if (!endpointToken) {
          throw new Error(
            'Could not determine token from endpoint. Use full WSS endpoint or provide --token.',
          );
        }
        const httpProtocol = protocol === 'wss:' ? 'https:' : 'http:';
        return {
          wsUrl,
          httpUrl: `${httpProtocol}//${parsed.host}/${endpointToken}/hypercore`,
        };
      }

      if (!token) {
        throw new Error(
          'Token is required when endpoint is not full Hypercore WSS URL. Provide --token or use full WSS endpoint.',
        );
      }
      return {
        wsUrl: `${protocol}//${parsed.host}/${token}/hypercore/ws`,
        httpUrl: `${protocol === 'wss:' ? 'https:' : 'http:'}//${parsed.host}/${token}/hypercore`,
      };
    }

    if (protocol === 'https:' || protocol === 'http:') {
      const normalizedPath = normalizePath(parsed.pathname);

      if (hasHypercoreHttpPath(normalizedPath)) {
        const endpointToken = extractTokenFromPath(normalizedPath) ?? token;
        if (!endpointToken) {
          throw new Error(
            'Could not determine token from endpoint. Use full Hypercore endpoint or provide --token.',
          );
        }
        return {
          wsUrl: `${protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}/${endpointToken}/hypercore/ws`,
          httpUrl: `${protocol}//${parsed.host}/${endpointToken}/hypercore`,
        };
      }

      if (!token) {
        throw new Error(
          'Token is required when endpoint URL does not include Hypercore token path. Provide --token.',
        );
      }

      return {
        wsUrl: `${protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}/${token}/hypercore/ws`,
        httpUrl: `${protocol}//${parsed.host}/${token}/hypercore`,
      };
    }
  }

  const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
  if (hasHypercoreWsPath(normalizedEndpoint)) {
    return {
      wsUrl: `wss://${normalizedEndpoint}`,
      httpUrl: `https://${normalizedEndpoint.replace(/\/ws$/, '')}`,
    };
  }
  if (hasHypercoreHttpPath(normalizedEndpoint)) {
    return {
      wsUrl: `wss://${normalizedEndpoint}/ws`,
      httpUrl: `https://${normalizedEndpoint}`,
    };
  }

  if (!token) {
    throw new Error(
      'Token is required when endpoint is provided as host only. Provide --token or use full WSS endpoint.',
    );
  }

  const host = normalizedEndpoint;
  return {
    wsUrl: `wss://${host}/${token}/hypercore/ws`,
    httpUrl: `https://${host}/${token}/hypercore`,
  };
}

export function extractTokenFromEndpoint(endpointInput: string): string | null {
  const endpoint = endpointInput.trim();

  if (looksLikeUrl(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      return extractTokenFromPath(parsed.pathname);
    } catch {
      return null;
    }
  }

  const segments = endpoint.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return extractTokenFromSegments(segments);
}

export function redactEndpointUrl(endpointInput: string): string {
  const endpoint = endpointInput.trim();
  if (!endpoint) {
    return endpointInput;
  }

  if (looksLikeUrl(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      parsed.pathname = redactHypercoreTokenPath(parsed.pathname);
      redactSensitiveSearchParams(parsed.searchParams);
      return parsed.toString();
    } catch {
      return redactHypercoreTokenPath(endpointInput);
    }
  }

  return redactHypercoreTokenPath(endpointInput);
}

export function redactSensitiveText(input: string, options?: { token?: string | null }): string {
  let redacted = input;

  redacted = redacted.replace(/(wss?|https?):\/\/[^\s'"`]+/gi, (value) => redactEndpointUrl(value));
  redacted = redactHypercoreTokenPath(redacted);
  redacted = redacted.replace(
    /([?&](?:token|api[_-]?key|authorization)=)([^&#\s]+)/gi,
    `$1${REDACTED_VALUE}`,
  );
  redacted = redacted.replace(
    /("(?:token|api[_-]?key|authorization)"\s*:\s*")([^"]+)(")/gi,
    `$1${REDACTED_VALUE}$3`,
  );

  const token = options?.token?.trim();
  if (token) {
    redacted = redacted.replace(new RegExp(escapeRegExp(token), 'g'), REDACTED_VALUE);
  }

  return redacted;
}

export function sanitizeEndpointForStorage(endpointInput: string): string {
  const endpoint = endpointInput.trim();
  if (!endpoint) {
    return endpointInput;
  }

  if (looksLikeUrl(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      parsed.search = '';
      parsed.hash = '';
      if (extractTokenFromPath(parsed.pathname)) {
        return `${parsed.protocol}//${parsed.host}`;
      }
      return trimTrailingSlash(parsed.toString());
    } catch {
      return endpoint;
    }
  }

  const normalized = endpoint.replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/').filter(Boolean);
  const hypercoreIndex = segments.findIndex((segment) => segment === 'hypercore');
  if (hypercoreIndex > 1) {
    return segments[0] ?? endpoint;
  }
  return endpoint;
}

function looksLikeUrl(value: string): boolean {
  return /^(wss?|https?):\/\//i.test(value);
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '');
}

function hasHypercoreWsPath(pathname: string): boolean {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const length = segments.length;
  if (length < 3) {
    return false;
  }
  return segments[length - 1] === 'ws' && segments[length - 2] === 'hypercore';
}

function hasHypercoreHttpPath(pathname: string): boolean {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const length = segments.length;
  if (length < 2) {
    return false;
  }
  return segments[length - 1] === 'hypercore';
}

function extractTokenFromPath(pathname: string): string | null {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return extractTokenFromSegments(segments);
}

function extractTokenFromSegments(segments: string[]): string | null {
  const hypercoreIndex = segments.findIndex((segment) => segment === 'hypercore');
  if (hypercoreIndex > 0) {
    return segments[hypercoreIndex - 1] ?? null;
  }
  return null;
}

function redactHypercoreTokenPath(value: string): string {
  return value.replace(
    /\/([^/\s?&#]+)\/hypercore(\/ws)?/gi,
    (_all, _token, wsSuffix = '') => `/${REDACTED_VALUE}/hypercore${wsSuffix}`,
  );
}

function redactSensitiveSearchParams(searchParams: URLSearchParams): void {
  for (const key of [...searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) {
      searchParams.set(key, REDACTED_VALUE);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}
