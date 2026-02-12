import { Command } from 'commander';

import { registerBackfillCommand } from './commands/backfill';
import { registerConfigCommand } from './commands/config';
import { registerCreditsCommand } from './commands/credits';
import { registerQueryCommand } from './commands/query';
import { registerSampleCommand } from './commands/sample';
import { registerStatsCommand } from './commands/stats';
import { registerStreamCommand } from './commands/stream';
import { redactSensitiveText } from './utils/url';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json') as { version: string };

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('hypercore-cli')
    .description('Quicknode HyperCore streaming CLI')
    .version(version);

  registerConfigCommand(program);
  registerCreditsCommand(program);
  registerStreamCommand(program);
  registerBackfillCommand(program);
  registerSampleCommand(program);
  registerStatsCommand(program);
  registerQueryCommand(program);

  await program.parseAsync(argv);
}

if (require.main === module) {
  runCli(process.argv).catch((error) => {
    const message = redactSensitiveText(error instanceof Error ? error.message : String(error));
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  });
}
