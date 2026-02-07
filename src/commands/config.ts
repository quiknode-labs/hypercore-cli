import { Command } from 'commander';

import { isKeychainAvailable, saveToken, clearSavedToken, getSavedToken } from '../config/keychain';
import { getConfigPath, readSavedConfig, writeSavedConfig, clearSavedConfig } from '../config/storage';
import { maskToken } from '../config/credentials';
import { promptAdapter } from '../utils/prompt';
import { extractTokenFromEndpoint } from '../utils/url';

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
        process.stdout.write(`Config path: ${getConfigPath()}\n`);
        process.stdout.write(`Endpoint: ${saved.endpoint ?? '(not set)'}\n`);
        process.stdout.write(`Token: ${maskToken(token)}\n`);
        process.stdout.write(`Keychain available: ${String(await isKeychainAvailable())}\n`);
        return;
      }

      const endpoint = await promptAdapter.ask(
        'Quicknode endpoint (recommended full WSS URL ending with /hypercore/ws): ',
      );
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

      await writeSavedConfig({ endpoint });
      await saveToken(token);

      process.stdout.write(`Saved endpoint to ${getConfigPath()} and token to system keychain.\n`);
    });
}
