import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const SERVICE_NAME = 'quicknode.hypercore-cli';
const ACCOUNT_NAME = 'wallet-private-key';
const WALLET_KEY_FILE_PATH = path.join(homedir(), '.hypercore-cli', 'wallet-key');

export type WalletKeyStorageBackend = 'keychain' | 'file' | 'none';

interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

let keytarCache: KeytarLike | null | undefined;

async function loadKeytar(): Promise<KeytarLike | null> {
  if (keytarCache !== undefined) {
    return keytarCache;
  }

  try {
    const module = (await import('keytar')) as unknown as KeytarLike;
    keytarCache = module;
  } catch {
    keytarCache = null;
  }

  return keytarCache;
}

export async function getSavedWalletKey(): Promise<string | null> {
  const keychainKey = await getKeychainWalletKey();
  if (keychainKey) {
    return keychainKey;
  }

  return getFileWalletKey();
}

export async function saveWalletKey(key: string): Promise<void> {
  if (await saveWalletKeyToKeychain(key)) {
    await clearFileWalletKey();
    return;
  }

  await saveWalletKeyToFile(key);
}

export async function clearWalletKey(): Promise<void> {
  await clearKeychainWalletKey();
  await clearFileWalletKey();
}

export function getWalletKeyFilePath(): string {
  return WALLET_KEY_FILE_PATH;
}

export async function getSavedWalletKeyStorageBackend(): Promise<WalletKeyStorageBackend> {
  const keychainKey = await getKeychainWalletKey();
  if (keychainKey) {
    return 'keychain';
  }

  const fileKey = await getFileWalletKey();
  if (fileKey) {
    return 'file';
  }

  return 'none';
}

async function getKeychainWalletKey(): Promise<string | null> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return null;
  }

  try {
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch {
    return null;
  }
}

async function saveWalletKeyToKeychain(key: string): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return false;
  }

  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
    return true;
  } catch {
    return false;
  }
}

async function clearKeychainWalletKey(): Promise<void> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return;
  }

  try {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch {
    // Ignore keychain backend errors during cleanup.
  }
}

async function getFileWalletKey(): Promise<string | null> {
  try {
    const payload = await readFile(WALLET_KEY_FILE_PATH, 'utf8');
    const key = payload.trim();
    return key ? key : null;
  } catch {
    return null;
  }
}

async function saveWalletKeyToFile(key: string): Promise<void> {
  await mkdir(path.dirname(WALLET_KEY_FILE_PATH), { recursive: true });
  await writeFile(WALLET_KEY_FILE_PATH, `${key.trim()}\n`, { mode: 0o600 });
}

async function clearFileWalletKey(): Promise<void> {
  await rm(WALLET_KEY_FILE_PATH, { force: true });
}
