import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';
import type { X402AuthManager } from './auth';

export function createX402Fetch(config: {
  authManager: X402AuthManager;
  privateKey: string;
}): typeof fetch {
  const account = privateKeyToAccount(config.privateKey as `0x${string}`);

  // Set up x402 auto-payment client
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });

  // Inner fetch: injects JWT Authorization header.
  // wrapFetchWithPayment passes Request objects (not raw URL+init), so we must
  // handle both forms to avoid dropping headers like Content-Type and PAYMENT-SIGNATURE.
  const authedFetch: typeof fetch = async (input, init) => {
    const jwt = await config.authManager.getValidJwt();
    if (input instanceof Request) {
      const request = input.clone();
      request.headers.set('Authorization', `Bearer ${jwt}`);
      return fetch(request, { signal: AbortSignal.timeout(30_000) });
    }
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${jwt}`);
    return fetch(input, { ...init, headers, signal: AbortSignal.timeout(30_000) });
  };

  // Wrap with x402 payment handling
  const paymentFetch = wrapFetchWithPayment(authedFetch, client);

  // Outer wrapper: catches 401 → invalidate → retry once
  const wrappedFetch: typeof fetch = async (input, init) => {
    const response = await paymentFetch(input, init);
    if (response.status === 401) {
      config.authManager.invalidate();
      return paymentFetch(input, init);
    }
    return response;
  };

  return wrappedFetch;
}
