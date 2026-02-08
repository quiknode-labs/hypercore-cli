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
import { promptAdapter } from '../utils/prompt';
import {
  extractTokenFromEndpoint,
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

        process.stdout.write(`Config path: ${getConfigPath()}\n`);
        process.stdout.write(`Endpoint: ${endpointDisplay}\n`);
        process.stdout.write(`Token: ${maskToken(token)}\n`);
        process.stdout.write(`Keychain available: ${String(keychainAvailable)}\n`);
        process.stdout.write(`Token storage preference: ${preferredBackend}\n`);
        process.stdout.write(`Token storage in use: ${savedBackend}\n`);
        if (savedBackend === 'file') {
          process.stdout.write(`Token file: ${getTokenFilePath()} (permissions 600)\n`);
        }
        return;
      }

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

      await writeSavedConfig({ endpoint: sanitizeEndpointForStorage(endpoint) });
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
