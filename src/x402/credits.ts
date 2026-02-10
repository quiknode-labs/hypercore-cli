import type { X402AuthManager } from './auth';

export interface X402Credits {
  accountId?: string;
  credits: number;
}

export async function fetchX402Credits(authManager: X402AuthManager): Promise<X402Credits> {
  const jwt = await authManager.getValidJwt();
  const url = `${authManager.getBaseUrl()}/credits`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GET /credits failed (HTTP ${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { accountId?: string; credits?: unknown };
  if (typeof payload.credits !== 'number' || Number.isNaN(payload.credits)) {
    throw new Error('GET /credits returned an invalid payload');
  }

  return {
    accountId: typeof payload.accountId === 'string' ? payload.accountId : undefined,
    credits: payload.credits,
  };
}
