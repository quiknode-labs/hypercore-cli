import { Command } from 'commander';

import { registerBackfillCommand } from './commands/backfill';
import { registerConfigCommand } from './commands/config';
import { registerQueryCommand } from './commands/query';
import { registerSampleCommand } from './commands/sample';
import { registerStatsCommand } from './commands/stats';
import { registerStreamCommand } from './commands/stream';
import { redactSensitiveText } from './utils/url';

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('hypercore-cli')
    .description('Quicknode HyperCore streaming CLI')
    .version('0.1.0');

  registerConfigCommand(program);
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
