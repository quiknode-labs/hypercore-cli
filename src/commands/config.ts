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
        process.stdout.write('Cleared saved configuration.\n');
        return;
      }

      if (options.show) {
        const saved = await readSavedConfig();
        const token = await getSavedToken();
        const keychainAvailable = await isKeychainAvailable();
        const preferredBackend = await getPreferredTokenStorageBackend();
        const savedBackend = await getSavedTokenStorageBackend();
        const endpointDisplay = saved.endpoint ? redactEndpointUrl(saved.endpoint) : '(not set)';

        const lines = [
          sc.bold('Configuration'),
          `  endpoint    ${endpointDisplay}`,
          `  token       ${maskToken(token)}`,
          `  storage     ${savedBackend}${keychainAvailable ? '' : ' (keychain unavailable)'}`,
          `  preference  ${preferredBackend}`,
          `  config      ${getConfigPath()}`,
        ];
        if (savedBackend === 'file') {
          lines.push(`  token file  ${getTokenFilePath()} (permissions 600)`);
        }
        process.stdout.write(`${lines.join('\n')}\n`);
        return;
      }

      const saved = await readSavedConfig();
      const existingToken = await getSavedToken();

      if (saved.endpoint) {
        process.stdout.write('\nYou already have a saved endpoint:\n');
        process.stdout.write(`  Endpoint: ${redactEndpointUrl(saved.endpoint)}\n`);
        process.stdout.write(`  Token: ${maskToken(existingToken)}\n\n`);
        process.stdout.write('To view full details, use: hypercore-cli config --show\n');

        const answer = await promptAdapter.ask('Do you want to override? (y/N): ');
        if (answer.toLowerCase() !== 'y') {
          return;
        }
        process.stdout.write('\n');
      }

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

      await writeSavedConfig({ endpoint });
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
