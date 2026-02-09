import { Command } from 'commander';

import {
  clearSavedToken,
  getPreferredTokenStorageBackend,
  getSavedToken,
  getSavedTokenStorageBackend,
  getTokenFilePath,
  isKeychainAvailable,
  saveToken,
} from '../config/keychain';
import { clearWalletKey, getSavedWalletKey, saveWalletKey } from '../config/wallet-keychain';
import { getConfigPath, readSavedConfig, writeSavedConfig, clearSavedConfig } from '../config/storage';
import { maskToken } from '../config/credentials';
import { promptAdapter } from '../utils/prompt';
import {
  extractTokenFromEndpoint,
  QUICKNODE_WSS_EXAMPLE,
  redactEndpointUrl,
  sanitizeEndpointForStorage,
} from '../utils/url';
import { X402_DEFAULT_BASE_URL, X402_DEFAULT_NETWORK } from '../x402/constants';

interface ConfigOptions {
  show?: boolean;
  clear?: boolean;
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Configure Quicknode endpoint and API token')
    .option('--show', 'Show current saved config (token masked)')
    .option('--clear', 'Clear saved endpoint and token')
    .action(async (options: ConfigOptions) => {
      if (options.clear) {
        await clearSavedConfig();
        await clearSavedToken();
        await clearWalletKey();
        process.stdout.write('Cleared saved configuration.\n');
        return;
      }

      if (options.show) {
        const saved = await readSavedConfig();
        const token = await getSavedToken();
        const walletKey = await getSavedWalletKey();
        const keychainAvailable = await isKeychainAvailable();
        const preferredBackend = await getPreferredTokenStorageBackend();
        const savedBackend = await getSavedTokenStorageBackend();
        const endpointDisplay = saved.endpoint ? redactEndpointUrl(saved.endpoint) : '(not set)';

        process.stdout.write(`Config path: ${getConfigPath()}\n`);
        process.stdout.write(`Mode: ${saved.mode ?? 'quicknode'}\n`);
        process.stdout.write(`Endpoint: ${endpointDisplay}\n`);
        process.stdout.write(`Token: ${maskToken(token)}\n`);
        process.stdout.write(`Keychain available: ${String(keychainAvailable)}\n`);
        process.stdout.write(`Token storage preference: ${preferredBackend}\n`);
        process.stdout.write(`Token storage in use: ${savedBackend}\n`);
        if (savedBackend === 'file') {
          process.stdout.write(`Token file: ${getTokenFilePath()} (permissions 600)\n`);
        }

        if (saved.mode === 'x402' || walletKey) {
          process.stdout.write(`\nx402 configuration:\n`);
          if (walletKey) {
            try {
              const { privateKeyToAccount } = await import('viem/accounts');
              const account = privateKeyToAccount(walletKey as `0x${string}`);
              process.stdout.write(`  Wallet address: ${account.address}\n`);
            } catch {
              process.stdout.write(`  Wallet key: ${maskToken(walletKey)}\n`);
            }
          } else {
            process.stdout.write(`  Wallet key: (not set)\n`);
          }
          process.stdout.write(`  Base URL: ${saved.x402BaseUrl ?? X402_DEFAULT_BASE_URL}\n`);
          process.stdout.write(`  Network: ${saved.x402Network ?? X402_DEFAULT_NETWORK}\n`);
          process.stdout.write(`  Payment chain: ${saved.x402Chain ?? 'base-sepolia'}\n`);
        }
        return;
      }

      const saved = await readSavedConfig();
      const existingToken = await getSavedToken();

      if (saved.endpoint || saved.mode) {
        process.stdout.write('\nYou already have a saved configuration:\n');
        process.stdout.write(`  Mode: ${saved.mode ?? 'quicknode'}\n`);
        if (saved.endpoint) {
          process.stdout.write(`  Endpoint: ${redactEndpointUrl(saved.endpoint)}\n`);
        }
        process.stdout.write(`  Token: ${maskToken(existingToken)}\n\n`);
        process.stdout.write('To view full details, use: hypercore-cli config --show\n');

        const answer = await promptAdapter.ask('Do you want to override? (y/N): ');
        if (answer.toLowerCase() !== 'y') {
          return;
        }
        process.stdout.write('\n');
      }

      process.stdout.write('Select connection mode:\n');
      process.stdout.write('  1) QuickNode Direct - use your QuickNode endpoint\n');
      process.stdout.write('  2) x402 Micropayments - pay per request with USDC (no QN account needed)\n');
      const modeAnswer = await promptAdapter.ask('Mode (1/2): ');
      const isX402 = modeAnswer.trim() === '2';
      process.stdout.write('\n');

      if (isX402) {
        const walletKeyInput = await promptAdapter.ask('Wallet private key (0x...): ', { secret: true });
        if (!walletKeyInput) {
          throw new Error('Wallet key is required for x402 mode');
        }

        let walletAddress: string;
        try {
          const { privateKeyToAccount } = await import('viem/accounts');
          const account = privateKeyToAccount(walletKeyInput as `0x${string}`);
          walletAddress = account.address;
        } catch {
          throw new Error('Invalid wallet private key');
        }

        const chainAnswer = await promptAdapter.ask('Payment chain (base-sepolia/base, default: base-sepolia): ');
        const chain = (chainAnswer.trim() === 'base' ? 'base' : 'base-sepolia') as 'base-sepolia' | 'base';

        const baseUrlAnswer = await promptAdapter.ask(
          `x402 proxy URL (default: ${X402_DEFAULT_BASE_URL}): `,
        );
        const baseUrl = baseUrlAnswer.trim() || undefined;

        await writeSavedConfig({
          mode: 'x402',
          x402BaseUrl: baseUrl,
          x402Network: X402_DEFAULT_NETWORK,
          x402Chain: chain,
        });
        await saveWalletKey(walletKeyInput);

        process.stdout.write(`\nSaved x402 configuration to ${getConfigPath()}\n`);
        process.stdout.write(`  Wallet address: ${walletAddress}\n`);
        process.stdout.write(`  Payment chain: ${chain}\n`);
        process.stdout.write(`  Base URL: ${baseUrl ?? X402_DEFAULT_BASE_URL}\n`);
        return;
      }

      // QuickNode Direct mode
      process.stdout.write('Quicknode onboarding:\n');
      process.stdout.write('1) Create or sign in to your Quicknode account.\n');
      process.stdout.write('2) Create a Hyperliquid endpoint.\n');
      process.stdout.write('3) Select the WSS endpoint and copy the Hypercore URL.\n');
      process.stdout.write(`Example: ${QUICKNODE_WSS_EXAMPLE}\n`);
      process.stdout.write('Tip: You can also paste just the endpoint host and enter token separately.\n');

      const endpoint = await promptAdapter.ask('Quicknode endpoint (host or full WSS URL): ', {
        secret: true,
      });
      if (!endpoint) {
        throw new Error('Endpoint is required');
      }

      const endpointToken = extractTokenFromEndpoint(endpoint);
      const token =
        endpointToken ??
        (await promptAdapter.ask('Quicknode API token: ', { secret: true }));
      if (!token) {
        throw new Error('Token is required');
      }

      await writeSavedConfig({ mode: 'quicknode', endpoint: sanitizeEndpointForStorage(endpoint) });
      await saveToken(token);

      const tokenStorageBackend = await getSavedTokenStorageBackend();
      if (tokenStorageBackend === 'keychain') {
        process.stdout.write(`Saved endpoint to ${getConfigPath()} and token to system keychain.\n`);
        return;
      }

      process.stdout.write(
        `Saved endpoint to ${getConfigPath()} and token to ${getTokenFilePath()} (permissions 600).\n`,
      );
    });
}
