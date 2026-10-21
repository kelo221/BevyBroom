import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITOR_STORAGE_KEY_PREFIX } from '@/settings/storage/clear_editor_storage.js';
import {
  STORAGE_MIGRATION_LEGACY_KEY_PREFIX,
  storageMigrationLegacyPrefixRun,
} from '@/settings/storage/storage_migration_legacy_prefix.js';

/**
 * Creates a Storage implementation backed by a Map.
 *
 * @returns Empty in-memory storage.
 */
function storageInMemoryCreate(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

/**
 * Lists every key of a storage backend.
 *
 * @param storage Storage backend to scan.
 * @returns Keys in storage order.
 */
function storageKeysList(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

describe('storageMigrationLegacyPrefixRun', () => {
  it('uses a legacy prefix different from the current prefix', () => {
    expect(STORAGE_MIGRATION_LEGACY_KEY_PREFIX).not.toBe(EDITOR_STORAGE_KEY_PREFIX);
  });

  it('copies legacy settings to the current prefix and removes the legacy keys', () => {
    const storage = storageInMemoryCreate();
    storage.setItem(`${STORAGE_MIGRATION_LEGACY_KEY_PREFIX}settings.view`, '{"grid":true}');
    storage.setItem(`${STORAGE_MIGRATION_LEGACY_KEY_PREFIX}preview.endpoint`, 'http://127.0.0.1:1');
    storage.setItem('unrelated.flag', '1');

    const removedCount = storageMigrationLegacyPrefixRun(storage);

    expect(removedCount).toBe(2);
    expect(storage.getItem(`${EDITOR_STORAGE_KEY_PREFIX}settings.view`)).toBe('{"grid":true}');
    expect(storage.getItem(`${EDITOR_STORAGE_KEY_PREFIX}preview.endpoint`)).toBe('http://127.0.0.1:1');
    expect(storage.getItem('unrelated.flag')).toBe('1');
    expect(storageKeysList(storage).some((key) => key.startsWith(STORAGE_MIGRATION_LEGACY_KEY_PREFIX))).toBe(false);
  });

  it('keeps an existing current value instead of overwriting it with the legacy one', () => {
    const storage = storageInMemoryCreate();
    storage.setItem(`${STORAGE_MIGRATION_LEGACY_KEY_PREFIX}settings.audio`, '{"enabled":false}');
    storage.setItem(`${EDITOR_STORAGE_KEY_PREFIX}settings.audio`, '{"enabled":true}');

    storageMigrationLegacyPrefixRun(storage);

    expect(storage.getItem(`${EDITOR_STORAGE_KEY_PREFIX}settings.audio`)).toBe('{"enabled":true}');
    expect(storage.getItem(`${STORAGE_MIGRATION_LEGACY_KEY_PREFIX}settings.audio`)).toBeNull();
  });

  it('does nothing on a second run', () => {
    const storage = storageInMemoryCreate();
    storage.setItem(`${STORAGE_MIGRATION_LEGACY_KEY_PREFIX}settings.mouse`, '{}');
    storageMigrationLegacyPrefixRun(storage);
    const keysAfterFirstRun = storageKeysList(storage);

    expect(storageMigrationLegacyPrefixRun(storage)).toBe(0);
    expect(storageKeysList(storage)).toEqual(keysAfterFirstRun);
  });

  it('runs before the editor is imported in both the web and desktop entries', () => {
    const webPage = readFileSync('index.html', 'utf8');
    const webEntry = readFileSync('src/app_bootstrap.ts', 'utf8');
    const desktopEntry = readFileSync('src/desktop/main_ui/index.ts', 'utf8');

    expect(webPage).toContain('/src/app_bootstrap.ts');
    for (const entry of [webEntry, desktopEntry]) {
      const migrationIndex = entry.indexOf('storageMigrationLegacyPrefixRunInBrowser();');
      expect(migrationIndex).toBeGreaterThan(-1);
      expect(migrationIndex).toBeLessThan(entry.indexOf("import('@/app.js')"));
    }
  });
});
