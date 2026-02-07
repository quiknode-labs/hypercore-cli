import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

export interface SavedConfig {
  endpoint?: string;
}

const CONFIG_DIR = path.join(homedir(), '.hypercore-cli');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export async function readSavedConfig(): Promise<SavedConfig> {
  try {
    const payload = await readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(payload) as SavedConfig;
    return parsed;
  } catch {
    return {};
  }
}

export async function writeSavedConfig(config: SavedConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const payload = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_PATH, payload, { mode: 0o600 });
}

export async function clearSavedConfig(): Promise<void> {
  await rm(CONFIG_PATH, { force: true });
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
