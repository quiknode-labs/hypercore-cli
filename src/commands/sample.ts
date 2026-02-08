import { Command } from 'commander';

import {
  getDatasetDefinition,
  isDatasetName,
  listDatasetDefinitions,
  type DatasetDefinition,
} from '../datasets/registry';

interface SampleOptions {
  dataset?: string;
  list?: boolean;
}

export function registerSampleCommand(program: Command): void {
  program
    .command('sample')
    .description('View dataset samples and field hints')
    .option('-d, --dataset <dataset>', 'Dataset name')
    .option('--list', 'List all available datasets', false)
    .action(async (options: SampleOptions) => {
      await sampleAction(options);
    });
}

async function sampleAction(options: SampleOptions): Promise<void> {
  if (options.list || !options.dataset) {
    process.stdout.write(renderDatasetList(listDatasetDefinitions()));
    if (!options.dataset) {
      return;
    }
  }

  if (!options.dataset || !isDatasetName(options.dataset)) {
    throw new Error(
      `Invalid --dataset '${options.dataset ?? ''}'. Expected one of: ${listDatasetDefinitions()
        .map((item) => item.name)
        .join(', ')}`,
    );
  }

  const dataset = getDatasetDefinition(options.dataset);
  process.stdout.write(renderDatasetSample(dataset));
}

function renderDatasetList(datasets: DatasetDefinition[]): string {
  const rows = datasets.map((dataset) => [
    dataset.name,
    dataset.description,
    dataset.volume,
    dataset.docsUrl,
  ]);

  const headers = ['Dataset', 'Description', 'Volume', 'Docs'];
  const widths = headers.map((header, column) => {
    const rowWidth = rows.reduce((max, row) => Math.max(max, row[column].length), 0);
    return Math.max(header.length, rowWidth);
  });

  const divider = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const headerLine = `| ${headers.map((h, i) => h.padEnd(widths[i])).join(' | ')} |`;

  const body = rows
    .map(
      (row) =>
        `| ${row.map((cell, i) => cell.padEnd(widths[i])).join(' | ')} |`,
    )
    .join('\n');

  return [
    'Available HyperCore datasets:\n',
    divider,
    headerLine,
    divider,
    body,
    divider,
    '',
  ].join('\n');
}

function renderDatasetSample(dataset: DatasetDefinition): string {
  const keyFields = dataset.keyFields.map((field) => `- ${field}`).join('\n');
  const sample = JSON.stringify(dataset.sampleEvent, null, 2);

  return [
    `${dataset.displayName} (${dataset.name})`,
    `${'='.repeat(dataset.displayName.length + dataset.name.length + 3)}`,
    dataset.description,
    `Estimated volume: ${dataset.volume}`,
    `Docs: ${dataset.docsUrl}`,
    '',
    'Key fields:',
    keyFields,
    '',
    'Sample event:',
    sample,
    '',
  ].join('\n');
}
