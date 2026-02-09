import { listDatasetDefinitions } from '../datasets/registry';
import type { DatasetName, OutputFormat } from '../types/common';
import {
  selectPrompt,
  textPrompt,
  type SelectOption,
  type SelectPromptConfig,
  type TextPromptConfig,
} from '../utils/interactive';

const DEFAULT_BATCH_SIZE = 100;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BackfillWizardResult {
  dataset: DatasetName;
  from: string;
  to: string;
  batchSize?: string;
  tokens?: string;
  users?: string;
  statuses?: string;
  output: OutputFormat;
  limit?: string;
}

export interface BackfillWizardContext {
  /** Pre-supplied flags that skip the corresponding wizard step */
  datasetFlag?: string;
  fromFlag?: string;
  toFlag?: string;
  batchSizeFlag?: string;
  tokensFlag?: string;
  usersFlag?: string;
  statusesFlag?: string;
  outputFlag?: string;
  limitFlag?: string;
}

/** Injectable prompt functions for testing */
export interface BackfillWizardPromptFns {
  selectPrompt: <T>(config: SelectPromptConfig<T>) => Promise<T>;
  textPrompt: (config: TextPromptConfig) => Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  Output format metadata                                             */
/* ------------------------------------------------------------------ */

const OUTPUT_OPTIONS: SelectOption<OutputFormat>[] = [
  { value: 'console', label: 'console', description: 'Pretty formatted terminal output' },
  { value: 'json', label: 'json', description: 'JSON lines (one object per line)' },
  { value: 'csv', label: 'csv', description: 'CSV format' },
  { value: 'sqlite', label: 'sqlite', description: 'Save to SQLite database' },
];

/* ------------------------------------------------------------------ */
/*  Wizard                                                             */
/* ------------------------------------------------------------------ */

export async function runBackfillWizard(
  context: BackfillWizardContext,
  promptFns?: Partial<BackfillWizardPromptFns>,
): Promise<BackfillWizardResult> {
  const select = promptFns?.selectPrompt ?? selectPrompt;
  const text = promptFns?.textPrompt ?? textPrompt;

  // Step 1: Dataset
  const dataset = context.datasetFlag
    ? (context.datasetFlag as DatasetName)
    : await promptDataset(select);

  // Step 2: Block range
  const from = context.fromFlag ?? (await promptBlock(text, 'Start block (inclusive)'));
  const to = context.toFlag ?? (await promptBlock(text, 'End block (inclusive)'));

  // Step 3: Batch size
  const batchSize = context.batchSizeFlag ?? (await promptBatchSize(text));

  // Step 4: Token filter
  const tokens = context.tokensFlag ?? (await promptFilter(text, dataset));

  // Step 5: User filter
  const users = context.usersFlag ?? (await promptUsers(text));

  // Step 6: Status filter (orders only)
  let statuses: string | undefined = context.statusesFlag;
  if (!statuses && dataset === 'orders') {
    statuses = await promptStatuses(text);
  }

  // Step 7: Output format
  const output = context.outputFlag
    ? (context.outputFlag as OutputFormat)
    : await promptOutput(select);

  // Step 8: Limit
  const limit = context.limitFlag ?? (await promptLimit(text));

  return { dataset, from, to, batchSize, tokens, users, statuses, output, limit };
}

/* ------------------------------------------------------------------ */
/*  Individual prompt steps                                            */
/* ------------------------------------------------------------------ */

async function promptDataset(
  select: <T>(config: SelectPromptConfig<T>) => Promise<T>,
): Promise<DatasetName> {
  const definitions = listDatasetDefinitions();
  const options: SelectOption<DatasetName>[] = definitions.map((def) => ({
    value: def.name,
    label: def.displayName.toLowerCase().padEnd(16),
    description: def.description,
  }));

  return select({
    message: 'Select dataset',
    options,
  });
}

async function promptBlock(
  text: (config: TextPromptConfig) => Promise<string>,
  label: 'Start block (inclusive)' | 'End block (inclusive)',
): Promise<string> {
  const answer = await text({
    message: `${label} (number)`,
  });
  const normalized = answer.trim();
  const parsed = Number.parseInt(normalized, 10);
  if (!/^\d+$/.test(normalized) || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label.toLowerCase()} '${answer}'. Must be >= 0.`);
  }
  return normalized;
}

async function promptBatchSize(
  text: (config: TextPromptConfig) => Promise<string>,
): Promise<string | undefined> {
  const answer = await text({
    message: 'Batch size (1-200)',
    defaultValue: String(DEFAULT_BATCH_SIZE),
  });
  const normalized = answer.trim();
  const parsed = Number.parseInt(normalized, 10);
  if (!/^\d+$/.test(normalized) || Number.isNaN(parsed) || parsed < 1 || parsed > 200) {
    throw new Error(`Invalid batch size '${answer}'. Must be an integer between 1 and 200.`);
  }
  return parsed === DEFAULT_BATCH_SIZE ? undefined : normalized;
}

async function promptFilter(
  text: (config: TextPromptConfig) => Promise<string>,
  dataset: DatasetName,
): Promise<string | undefined> {
  const label = dataset === 'writer_actions' ? 'tokens' : 'coins';
  const example = dataset === 'writer_actions' ? 'e.g. 124 or 124,125' : 'e.g. BTC or BTC,ETH';
  const answer = await text({
    message: `Filter by ${label} (${example}, or 'all')`,
    defaultValue: 'all',
  });
  return answer.toLowerCase() === 'all' ? undefined : answer || undefined;
}

async function promptUsers(
  text: (config: TextPromptConfig) => Promise<string>,
): Promise<string | undefined> {
  const answer = await text({
    message: "Filter by users (e.g. 0x123 or 0x123,0x456, or 'all')",
    defaultValue: 'all',
  });
  return answer.toLowerCase() === 'all' ? undefined : answer || undefined;
}

async function promptStatuses(
  text: (config: TextPromptConfig) => Promise<string>,
): Promise<string | undefined> {
  const answer = await text({
    message: "Filter by statuses (e.g. open or open,filled,canceled, or 'all')",
    defaultValue: 'all',
  });
  return answer.toLowerCase() === 'all' ? undefined : answer || undefined;
}

async function promptOutput(
  select: <T>(config: SelectPromptConfig<T>) => Promise<T>,
): Promise<OutputFormat> {
  return select({
    message: 'Output format',
    options: OUTPUT_OPTIONS,
  });
}

async function promptLimit(
  text: (config: TextPromptConfig) => Promise<string>,
): Promise<string | undefined> {
  const answer = await text({
    message: 'Event limit (number, or 0 for unlimited)',
    defaultValue: '0',
  });
  const normalized = answer.trim();
  if (!normalized || normalized === '0') {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!/^\d+$/.test(normalized) || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid limit '${answer}'. Must be >= 0.`);
  }
  return normalized;
}
