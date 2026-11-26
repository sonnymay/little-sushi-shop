export const SAVE_VERSION = 1 as const;
export const SAVE_KEY = 'little-sushi-shop-save-v1';
export const DEFAULT_COINS = 100;

export interface SaveData {
  version: number;
  coins: number;
  chefsKnifeOwned: boolean;
  totalGuestsServed: number;
}

export type SaveInput = Omit<SaveData, 'version'>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SAVE: Readonly<SaveData> = Object.freeze({
  version: SAVE_VERSION,
  coins: DEFAULT_COINS,
  chefsKnifeOwned: false,
  totalGuestsServed: 0,
});

export function createDefaultSave(): SaveData {
  return { ...DEFAULT_SAVE };
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (
      typeof globalThis !== 'undefined' &&
      'localStorage' in globalThis &&
      globalThis.localStorage != null
    ) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseSaveData(raw: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createDefaultSave();
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return createDefaultSave();
  }

  const record = parsed as Record<string, unknown>;

  if (record.version !== SAVE_VERSION) {
    return createDefaultSave();
  }

  if (
    !isNonNegativeFiniteNumber(record.coins) ||
    typeof record.chefsKnifeOwned !== 'boolean' ||
    !isNonNegativeFiniteNumber(record.totalGuestsServed)
  ) {
    return createDefaultSave();
  }

  return {
    version: SAVE_VERSION,
    coins: Math.floor(record.coins),
    chefsKnifeOwned: record.chefsKnifeOwned,
    totalGuestsServed: Math.floor(record.totalGuestsServed),
  };
}

export function load(storage: StorageLike | null = getDefaultStorage()): SaveData {
  if (!storage) {
    return createDefaultSave();
  }

  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) {
      return createDefaultSave();
    }
    return parseSaveData(raw);
  } catch {
    return createDefaultSave();
  }
}

export function save(
  data: SaveInput | SaveData,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  if (
    !isNonNegativeFiniteNumber(data.coins) ||
    !isNonNegativeFiniteNumber(data.totalGuestsServed)
  ) {
    console.warn('little-sushi-shop: save() received invalid values, sanitizing', data);
  }

  const payload: SaveData = {
    version: SAVE_VERSION,
    coins: isNonNegativeFiniteNumber(data.coins)
      ? Math.floor(data.coins)
      : DEFAULT_COINS,
    chefsKnifeOwned: Boolean(data.chefsKnifeOwned),
    totalGuestsServed: isNonNegativeFiniteNumber(data.totalGuestsServed)
      ? Math.floor(data.totalGuestsServed)
      : 0,
  };

  try {
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clear(storage: StorageLike | null = getDefaultStorage()): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
