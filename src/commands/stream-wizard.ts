import { getDatasetDefinition, listDatasetDefinitions } from '../datasets/registry';
import type { DatasetName, OutputFormat } from '../types/common';
import type { TransportType } from '../types/transport';
import {
  selectPrompt,
  textPrompt,
  type SelectOption,
  type SelectPromptConfig,
  type TextPromptConfig,
} from '../utils/interactive';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WizardResult {
  dataset: DatasetName;
  transport: TransportType;
  tokens?: string;
  users?: string;
  statuses?: string;
  output: OutputFormat;
  limit?: string;
}

export interface WizardContext {
  /** Pre-supplied flags that skip the corresponding wizard step */
  datasetFlag?: string;
  transportFlag?: string;
  tokensFlag?: string;
  usersFlag?: string;
  statusesFlag?: string;
  outputFlag?: string;
  limitFlag?: string;
  /** Connection mode — used to filter unavailable datasets/transports */
  connectionMode?: 'quicknode' | 'x402';
}

/** Injectable prompt functions for testing */
export interface WizardPromptFns {
  selectPrompt: <T>(config: SelectPromptConfig<T>) => Promise<T>;
  textPrompt: (config: TextPromptConfig) => Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  Output format metadata                                             */
/* ------------------------------------------------------------------ */

const TRANSPORT_OPTIONS: SelectOption<TransportType>[] = [
  { value: 'wss', label: 'WSS', description: 'WebSocket (default)' },
  { value: 'grpc', label: 'gRPC', description: 'gRPC transport' },
];

const OUTPUT_OPTIONS: SelectOption<OutputFormat>[] = [
  { value: 'console', label: 'console', description: 'Pretty formatted terminal output' },
  { value: 'json', label: 'json', description: 'JSON lines (one object per line)' },
  { value: 'csv', label: 'csv', description: 'CSV format' },
  { value: 'sqlite', label: 'sqlite', description: 'Save to SQLite database' },
];

/* ------------------------------------------------------------------ */
/*  Wizard                                                             */
/* ------------------------------------------------------------------ */

export async function runStreamWizard(
  context: WizardContext,
  promptFns?: Partial<WizardPromptFns>,
): Promise<WizardResult> {
  const select = promptFns?.selectPrompt ?? selectPrompt;
  const text = promptFns?.textPrompt ?? textPrompt;

  const isX402 = context.connectionMode === 'x402';

  // Step 1: Dataset
  const dataset = context.datasetFlag
    ? (context.datasetFlag as DatasetName)
    : await promptDataset(select, isX402);

  // Step 2: Transport
  const definition = getDatasetDefinition(dataset);
  let transport: TransportType;
  if (isX402) {
    // x402 mode only supports WSS (gRPC requires HTTP/2 which x402 proxy cannot provide)
    transport = 'wss';
  } else if (context.transportFlag) {
    transport = context.transportFlag as TransportType;
  } else if (definition.grpcOnly) {
    transport = 'grpc';
  } else {
    transport = await promptTransport(select);
  }

  // Steps 3-5: Filters (blocks dataset has no filters — skip entirely)
  let tokens: string | undefined;
  let users: string | undefined;
  let statuses: string | undefined;
  if (dataset !== 'blocks') {
    tokens = context.tokensFlag ?? (await promptFilter(text, dataset));
    users = context.usersFlag ?? (await promptUsers(text));
    statuses = context.statusesFlag;
    if (!statuses && dataset === 'orders') {
      statuses = await promptStatuses(text);
    }
  }

  // Step 6: Output format
  const output = context.outputFlag
    ? (context.outputFlag as OutputFormat)
    : await promptOutput(select);

  // Step 7: Limit
  const limit = context.limitFlag ?? (await promptLimit(text));

  return { dataset, transport, tokens, users, statuses, output, limit };
}

/* ------------------------------------------------------------------ */
/*  Individual prompt steps                                            */
/* ------------------------------------------------------------------ */

async function promptDataset(
  select: <T>(config: SelectPromptConfig<T>) => Promise<T>,
  isX402 = false,
): Promise<DatasetName> {
  let definitions = listDatasetDefinitions();
  if (isX402) {
    // x402 mode cannot support gRPC-only datasets (e.g. blocks) — requires HTTP/2
    definitions = definitions.filter((def) => !def.grpcOnly);
  }
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

async function promptTransport(
  select: <T>(config: SelectPromptConfig<T>) => Promise<T>,
): Promise<TransportType> {
  return select({
    message: 'Transport',
    options: TRANSPORT_OPTIONS,
  });
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
