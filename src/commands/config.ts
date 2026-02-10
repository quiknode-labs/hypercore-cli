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
import {
  clearWalletKey,
  getSavedWalletKey,
  getSavedWalletKeyStorageBackend,
  getWalletKeyFilePath,
  saveWalletKey,
} from '../config/wallet-keychain';
import { getConfigPath, readSavedConfig, writeSavedConfig, clearSavedConfig } from '../config/storage';
import { maskToken } from '../config/credentials';
import { stdoutColors as sc } from '../utils/ansi';
import { selectPrompt } from '../utils/interactive';
import { promptAdapter } from '../utils/prompt';
import {
  extractTokenFromEndpoint,
  QUICKNODE_GRPC_EXAMPLE,
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
    .description('Configure Quicknode endpoint or x402 micropayments settings')
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
        const walletStorageBackend = await getSavedWalletKeyStorageBackend();
        const keychainAvailable = await isKeychainAvailable();
        const preferredBackend = await getPreferredTokenStorageBackend();
        const savedBackend = await getSavedTokenStorageBackend();
        const endpointDisplay = saved.endpoint ? redactEndpointUrl(saved.endpoint) : '(not set)';

        const lines = [
          sc.bold('Configuration'),
          `  mode       ${saved.mode ?? 'quicknode'}`,
          `  endpoint   ${endpointDisplay}`,
          `  token      ${maskToken(token)}`,
          `  storage    ${savedBackend}${keychainAvailable ? '' : ' (keychain unavailable)'}`,
          `  preference ${preferredBackend}`,
          `  config     ${getConfigPath()}`,
        ];
        if (savedBackend === 'file') {
          lines.push(`  token file ${getTokenFilePath()} (permissions 600)`);
        }
        process.stdout.write(`${lines.join('\n')}\n`);

        if (saved.mode === 'x402' || walletKey) {
          const x402Lines = ['\nx402 configuration:'];
          if (walletKey) {
            try {
              const { privateKeyToAccount } = await import('viem/accounts');
              const account = privateKeyToAccount(walletKey as `0x${string}`);
              x402Lines.push(`  Wallet address: ${account.address}`);
            } catch {
              x402Lines.push(`  Wallet key: ${maskToken(walletKey)}`);
            }
          } else {
            x402Lines.push('  Wallet key: (not set)');
          }
          x402Lines.push(`  Base URL: ${saved.x402BaseUrl ?? X402_DEFAULT_BASE_URL}`);
          x402Lines.push(`  Network: ${saved.x402Network ?? X402_DEFAULT_NETWORK}`);
          x402Lines.push(`  Payment chain: ${saved.x402Chain ?? 'base-sepolia'}`);
          x402Lines.push(`  Wallet storage: ${walletStorageBackend}`);
          if (walletStorageBackend === 'file') {
            x402Lines.push(`  Wallet key file: ${getWalletKeyFilePath()} (permissions 600)`);
          }
          process.stdout.write(`${x402Lines.join('\n')}\n`);
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

      const mode = await selectPrompt({
        message: 'Select connection mode',
        options: [
          { value: 'quicknode', label: 'Quicknode Direct', description: 'All datasets + gRPC support' },
          { value: 'x402', label: 'x402 Micropayments', description: 'Pay with USDC (blocks & gRPC not yet supported)' },
        ],
      });

      if (mode === 'x402') {
        process.stdout.write('\nNote: Private key must include the 0x prefix (e.g. 0x1234...abcd)\n');
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
        const walletStorageBackend = await getSavedWalletKeyStorageBackend();

        process.stdout.write(`\nSaved x402 configuration to ${getConfigPath()}\n`);
        process.stdout.write(`  Wallet address: ${walletAddress}\n`);
        process.stdout.write(`  Payment chain: ${chain}\n`);
        process.stdout.write(`  Base URL: ${baseUrl ?? X402_DEFAULT_BASE_URL}\n`);
        if (walletStorageBackend === 'keychain') {
          process.stdout.write('  Wallet key storage: system keychain\n');
        } else if (walletStorageBackend === 'file') {
          process.stdout.write(`  Wallet key storage: ${getWalletKeyFilePath()} (permissions 600)\n`);
        }
        return;
      }

      // Quicknode Direct mode
      process.stdout.write('Quicknode onboarding:\n');
      const dashboardUrl = 'https://dashboard.quicknode.com?utm_source=qn-hype-cli';
      const link = `\x1b]8;;${dashboardUrl}\x1b\\Quicknode account\x1b]8;;\x1b\\`;
      process.stdout.write(`1) Create or sign in to your ${link}.\n`);
      process.stdout.write('2) Create a Hyperliquid endpoint.\n');

      const transport = await selectPrompt({
        message: 'Connect via',
        options: [
          { value: 'wss', label: 'WSS', description: 'WebSocket (default)' },
          { value: 'grpc', label: 'gRPC', description: 'gRPC transport' },
        ],
      });
      const isGrpc = transport === 'grpc';

      let endpoint: string;
      let token: string;

      if (isGrpc) {
        process.stdout.write('3) Copy the gRPC endpoint and auth token from your dashboard.\n');
        process.stdout.write(`Example: ${QUICKNODE_GRPC_EXAMPLE}\n`);

        const grpcEndpoint = await promptAdapter.ask(
          `gRPC endpoint (e.g. ${QUICKNODE_GRPC_EXAMPLE}): `,
          { secret: true },
        );
        if (!grpcEndpoint) {
          throw new Error('Endpoint is required');
        }

        const grpcToken = await promptAdapter.ask('Auth token: ', { secret: true });
        if (!grpcToken) {
          throw new Error('Token is required');
        }

        // Strip :10000 port if present — deriveEndpointUrls appends it for gRPC
        endpoint = grpcEndpoint.trim().replace(/:10000$/, '');
        token = grpcToken.trim();
      } else {
        process.stdout.write('3) Select the WSS endpoint and copy the Hypercore URL.\n');
        process.stdout.write(`Example: ${QUICKNODE_WSS_EXAMPLE}\n`);
        process.stdout.write(
          'Tip: You can also paste just the endpoint host and enter token separately.\n',
        );

        const wssEndpoint = await promptAdapter.ask('Quicknode endpoint (host or full WSS URL): ', {
          secret: true,
        });
        if (!wssEndpoint) {
          throw new Error('Endpoint is required');
        }

        const endpointToken = extractTokenFromEndpoint(wssEndpoint);
        const wssToken =
          endpointToken ??
          (await promptAdapter.ask('Quicknode API token: ', { secret: true }));
        if (!wssToken) {
          throw new Error('Token is required');
        }

        endpoint = sanitizeEndpointForStorage(wssEndpoint);
        token = wssToken;
      }

      await writeSavedConfig({ mode: 'quicknode', endpoint });
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
