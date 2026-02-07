const SERVICE_NAME = 'quicknode.hypercore-cli';
const ACCOUNT_NAME = 'api-token';

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

export async function isKeychainAvailable(): Promise<boolean> {
  const keytar = await loadKeytar();
  return keytar !== null;
}

export async function getSavedToken(): Promise<string | null> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return null;
  }
  return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

export async function saveToken(token: string): Promise<void> {
  const keytar = await loadKeytar();
  if (!keytar) {
    throw new Error('System keychain is unavailable in this environment.');
  }
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
}

export async function clearSavedToken(): Promise<void> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return;
  }
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
