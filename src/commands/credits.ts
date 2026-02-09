import { Command } from 'commander';

import { resolveCredentials } from '../config/credentials';
import { promptAdapter } from '../utils/prompt';
import { createX402AuthManager } from '../x402/auth';
import { X402_CHAIN_IDS } from '../x402/constants';
import { fetchX402Credits } from '../x402/credits';

interface CreditsOptions {
  walletKey?: string;
  x402Url?: string;
  json?: boolean;
}

export function registerCreditsCommand(program: Command): void {
  program
    .command('credits')
    .description('Check x402 credits without triggering a paid request')
    .option('--wallet-key <key>', 'Wallet private key for x402 auth')
    .option('--x402-url <url>', 'x402 proxy base URL override')
    .option('--json', 'Output as JSON', false)
    .action(async (options: CreditsOptions) => {
      await creditsAction(options);
    });
}

async function creditsAction(options: CreditsOptions): Promise<void> {
  const credentials = await resolveCredentials({
    modeFlag: 'x402',
    walletKeyFlag: options.walletKey,
    x402BaseUrlFlag: options.x402Url,
    promptOnMissing: true,
    prompt: promptAdapter,
  });
  const chain = credentials.x402Chain ?? 'base-sepolia';
  const chainId = X402_CHAIN_IDS[chain] ?? X402_CHAIN_IDS['base-sepolia'];

  const authManager = createX402AuthManager({
    privateKey: credentials.walletKey!,
    baseUrl: credentials.x402BaseUrl!,
    chainId,
  });
  const { credits, accountId } = await fetchX402Credits(authManager);
  const wallet = authManager.getWalletAddress();

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        wallet,
        accountId,
        credits,
        chain,
        baseUrl: credentials.x402BaseUrl,
      })}\n`,
    );
    return;
  }

  process.stdout.write(`x402 wallet: ${wallet}\n`);
  process.stdout.write(`x402 chain: ${chain}\n`);
  process.stdout.write(`x402 proxy: ${credentials.x402BaseUrl}\n`);
  process.stdout.write(`x402 credits: ${credits}\n`);
}
