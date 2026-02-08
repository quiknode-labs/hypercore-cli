import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const SERVICE_NAME = 'quicknode.hypercore-cli';
const ACCOUNT_NAME = 'api-token';
const TOKEN_FILE_PATH = path.join(homedir(), '.hypercore-cli', 'token');

interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export type TokenStorageBackend = 'keychain' | 'file' | 'none';

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

export async function isKeychainAvailable(): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return false;
  }

  try {
    await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return true;
  } catch {
    return false;
  }
}

export async function getSavedToken(): Promise<string | null> {
  const keychainToken = await getKeychainToken();
  if (keychainToken) {
    return keychainToken;
  }

  return getFileToken();
}

export async function saveToken(token: string): Promise<void> {
  if (await saveTokenToKeychain(token)) {
    await clearFileToken();
    return;
  }

  await saveTokenToFile(token);
}

export async function clearSavedToken(): Promise<void> {
  await clearKeychainToken();
  await clearFileToken();
}

export async function getPreferredTokenStorageBackend(): Promise<'keychain' | 'file'> {
  const keychainAvailable = await isKeychainAvailable();
  return keychainAvailable ? 'keychain' : 'file';
}

export async function getSavedTokenStorageBackend(): Promise<TokenStorageBackend> {
  const keychainToken = await getKeychainToken();
  if (keychainToken) {
    return 'keychain';
  }

  const fileToken = await getFileToken();
  if (fileToken) {
    return 'file';
  }

  return 'none';
}

export function getTokenFilePath(): string {
  return TOKEN_FILE_PATH;
}

async function getKeychainToken(): Promise<string | null> {
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

async function saveTokenToKeychain(token: string): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return false;
  }

  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    return true;
  } catch {
    return false;
  }
}

async function clearKeychainToken(): Promise<void> {
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

async function getFileToken(): Promise<string | null> {
  try {
    const payload = await readFile(TOKEN_FILE_PATH, 'utf8');
    const token = payload.trim();
    return token ? token : null;
  } catch {
    return null;
  }
}

async function saveTokenToFile(token: string): Promise<void> {
  await mkdir(path.dirname(TOKEN_FILE_PATH), { recursive: true });
  await writeFile(TOKEN_FILE_PATH, `${token.trim()}\n`, { mode: 0o600 });
}

async function clearFileToken(): Promise<void> {
  await rm(TOKEN_FILE_PATH, { force: true });
}
