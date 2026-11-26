import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  SAVE_VERSION,
  clear,
  load,
  save,
  type StorageLike,
} from '../src/save';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

describe('save persistence', () => {
  let memoryStorage: StorageLike;

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
    vi.stubGlobal('localStorage', memoryStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns default save data when nothing is stored', () => {
    const loaded = load();

    expect(loaded).toEqual({
      version: SAVE_VERSION,
      coins: 100,
      chefsKnifeOwned: false,
      totalGuestsServed: 0,
    });
    expect(loaded).not.toBe(DEFAULT_SAVE);
  });

  it('round-trips saved data through localStorage', () => {
    const ok = save({
      coins: 245,
      chefsKnifeOwned: true,
      totalGuestsServed: 19,
    });

    expect(ok).toBe(true);
    expect(memoryStorage.getItem(SAVE_KEY)).toBe(
      JSON.stringify({
        version: SAVE_VERSION,
        coins: 245,
        chefsKnifeOwned: true,
        totalGuestsServed: 19,
      }),
    );

    expect(load()).toEqual({
      version: SAVE_VERSION,
      coins: 245,
      chefsKnifeOwned: true,
      totalGuestsServed: 19,
    });
  });

  it('falls back to defaults on corrupt JSON or invalid field types', () => {
    memoryStorage.setItem(SAVE_KEY, '{not-valid-json');
    expect(load()).toEqual(DEFAULT_SAVE);

    memoryStorage.setItem(SAVE_KEY, 'null');
    expect(load()).toEqual(DEFAULT_SAVE);

    memoryStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        coins: '100',
        chefsKnifeOwned: false,
        totalGuestsServed: 0,
      }),
    );
    expect(load()).toEqual(DEFAULT_SAVE);

    memoryStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        coins: -5,
        chefsKnifeOwned: false,
        totalGuestsServed: 3,
      }),
    );
    expect(load()).toEqual(DEFAULT_SAVE);
  });

  it('falls back to defaults on version mismatch', () => {
    memoryStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION + 1,
        coins: 500,
        chefsKnifeOwned: true,
        totalGuestsServed: 42,
      }),
    );
    expect(load()).toEqual(DEFAULT_SAVE);

    memoryStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        coins: 500,
        chefsKnifeOwned: true,
        totalGuestsServed: 42,
      }),
    );
    expect(load()).toEqual(DEFAULT_SAVE);
  });

  it('clear() removes the saved entry and resets subsequent loads to defaults', () => {
    save({
      coins: 310,
      chefsKnifeOwned: true,
      totalGuestsServed: 12,
    });
    expect(load().coins).toBe(310);

    expect(clear()).toBe(true);
    expect(memoryStorage.getItem(SAVE_KEY)).toBeNull();
    expect(load()).toEqual(DEFAULT_SAVE);
  });

  it('sanitizes bad input values on save instead of writing them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(save({ coins: Number.NaN, chefsKnifeOwned: false, totalGuestsServed: -3 })).toBe(true);
      expect(load()).toEqual({
        version: SAVE_VERSION,
        coins: 100,
        chefsKnifeOwned: false,
        totalGuestsServed: 0,
      });
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('handles missing storage (null) without throwing', () => {
    expect(load(null)).toEqual(DEFAULT_SAVE);
    expect(save({ coins: 10, chefsKnifeOwned: false, totalGuestsServed: 0 }, null)).toBe(false);
    expect(clear(null)).toBe(false);
  });

  it('handles storage exceptions gracefully without throwing', () => {
    const brokenStorage: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(load(brokenStorage)).toEqual(DEFAULT_SAVE);
    expect(
      save({ coins: 150, chefsKnifeOwned: false, totalGuestsServed: 1 }, brokenStorage),
    ).toBe(false);
    expect(clear(brokenStorage)).toBe(false);
  });
});
