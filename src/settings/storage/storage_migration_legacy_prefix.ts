import { EDITOR_STORAGE_KEY_PREFIX } from '@/settings/storage/clear_editor_storage.js';

/** Key prefix the editor used for its storage before it was renamed. */
export const STORAGE_MIGRATION_LEGACY_KEY_PREFIX = 'aiworlded.';

/**
 * Moves every legacy-prefixed key of one storage backend to the current prefix.
 * A value is copied only when the current key is still absent; the legacy key
 * is always removed.
 *
 * @param storage Storage backend to migrate.
 * @returns Number of legacy keys removed.
 */
export function storageMigrationLegacyPrefixRun(storage: Storage): number {
  const legacyKeys = storageMigrationLegacyKeysCollect(storage);
  for (const legacyKey of legacyKeys) {
    storageMigrationLegacyKeyMove(storage, legacyKey);
  }
  return legacyKeys.length;
}

/**
 * Migrates the browser's local and session storage when they are available.
 *
 * @returns Number of legacy keys removed across both backends.
 */
export function storageMigrationLegacyPrefixRunInBrowser(): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  return (
    storageMigrationLegacyPrefixRunIfPresent(window.localStorage) +
    storageMigrationLegacyPrefixRunIfPresent(window.sessionStorage)
  );
}

/**
 * Migrates a storage backend when it exists.
 *
 * @param storage Storage backend, or undefined when the browser has none.
 * @returns Number of legacy keys removed (0 without a backend).
 */
function storageMigrationLegacyPrefixRunIfPresent(storage: Storage | undefined): number {
  return storage ? storageMigrationLegacyPrefixRun(storage) : 0;
}

/**
 * Lists the keys of a storage backend that start with the legacy prefix.
 *
 * @param storage Storage backend to scan.
 * @returns Legacy keys in storage order.
 */
function storageMigrationLegacyKeysCollect(storage: Storage): string[] {
  const legacyKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(STORAGE_MIGRATION_LEGACY_KEY_PREFIX)) {
      legacyKeys.push(key);
    }
  }
  return legacyKeys;
}

/**
 * Copies one legacy key to its current-prefix name unless that name is already
 * taken, then removes the legacy key.
 *
 * @param storage Storage backend holding the key.
 * @param legacyKey Key that starts with the legacy prefix.
 */
function storageMigrationLegacyKeyMove(storage: Storage, legacyKey: string): void {
  const currentKey = EDITOR_STORAGE_KEY_PREFIX + legacyKey.slice(STORAGE_MIGRATION_LEGACY_KEY_PREFIX.length);
  const legacyValue = storage.getItem(legacyKey);
  if (legacyValue !== null && storage.getItem(currentKey) === null) {
    storage.setItem(currentKey, legacyValue);
  }
  storage.removeItem(legacyKey);
}
