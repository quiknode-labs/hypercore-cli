export interface EndpointUrls {
  wsUrl: string;
  httpUrl: string;
  grpcUrl: string;
}

const REDACTED_VALUE = '****';
const SENSITIVE_QUERY_KEY_PATTERN = /(token|api[_-]?key|authorization)/i;
export const QUICKNODE_WSS_EXAMPLE =
  'wss://YOUR_ENDPOINT_NAME.hype-mainnet.quiknode.pro/YOUR_TOKEN/hypercore/ws';
export const QUICKNODE_GRPC_EXAMPLE = 'YOUR_ENDPOINT_NAME.hype-mainnet.quiknode.pro:10000';

const GRPC_PORT = 10000;

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
          grpcUrl: toGrpcUrl(parsed.hostname),
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
        grpcUrl: toGrpcUrl(parsed.hostname),
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
          grpcUrl: toGrpcUrl(parsed.hostname),
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
        grpcUrl: toGrpcUrl(parsed.hostname),
      };
    }
  }

  const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
  if (hasHypercoreWsPath(normalizedEndpoint)) {
    const host = normalizedEndpoint.split('/')[0] ?? normalizedEndpoint;
    return {
      wsUrl: `wss://${normalizedEndpoint}`,
      httpUrl: `https://${normalizedEndpoint.replace(/\/ws$/, '')}`,
      grpcUrl: toGrpcUrl(stripPort(host)),
    };
  }
  if (hasHypercoreHttpPath(normalizedEndpoint)) {
    const host = normalizedEndpoint.split('/')[0] ?? normalizedEndpoint;
    return {
      wsUrl: `wss://${normalizedEndpoint}/ws`,
      httpUrl: `https://${normalizedEndpoint}`,
      grpcUrl: toGrpcUrl(stripPort(host)),
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
    grpcUrl: toGrpcUrl(stripPort(host)),
  };
}

function toGrpcUrl(hostname: string): string {
  return `${hostname}:${GRPC_PORT}`;
}

function stripPort(hostWithOptionalPort: string): string {
  const colonIndex = hostWithOptionalPort.lastIndexOf(':');
  if (colonIndex === -1) {
    return hostWithOptionalPort;
  }
  const afterColon = hostWithOptionalPort.slice(colonIndex + 1);
  if (/^\d+$/.test(afterColon)) {
    return hostWithOptionalPort.slice(0, colonIndex);
  }
  return hostWithOptionalPort;
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
      parsed.hostname = redactHostname(parsed.hostname);
      parsed.pathname = redactHypercoreTokenPath(parsed.pathname);
      redactSensitiveSearchParams(parsed.searchParams);
      return parsed.toString();
    } catch {
      return redactHypercoreTokenPath(endpointInput);
    }
  }

  // Handle bare hostname:port (e.g. gRPC URLs like host.quiknode.pro:10000)
  const colonIndex = endpoint.lastIndexOf(':');
  if (colonIndex > 0) {
    const afterColon = endpoint.slice(colonIndex + 1);
    if (/^\d+$/.test(afterColon)) {
      return `${redactHostname(endpoint.slice(0, colonIndex))}:${afterColon}`;
    }
  }

  // Handle bare hostname (e.g. saved endpoint like name.hype-mainnet.quiknode.pro)
  if (endpoint.includes('.') && !endpoint.includes('/')) {
    return redactHostname(endpoint);
  }

  return redactHypercoreTokenPath(endpointInput);
}

export function redactSensitiveText(input: string, options?: { token?: string | null }): string {
  let redacted = input;

  redacted = redacted.replace(/(wss?|https?):\/\/[^\s'"`]+/gi, (value) => redactEndpointUrl(value));
  // Redact bare hostname:port (e.g. gRPC endpoints like host.quiknode.pro:10000)
  redacted = redacted.replace(/[a-z0-9-]+\.[\w.-]+:\d+/gi, (value) => redactEndpointUrl(value));
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

function redactHostname(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length < 2) {
    return hostname;
  }
  const subdomain = parts[0] ?? '';
  if (subdomain.length <= 6) {
    parts[0] = REDACTED_VALUE;
  } else {
    parts[0] = `${subdomain.slice(0, 3)}***${subdomain.slice(-3)}`;
  }
  return parts.join('.');
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
