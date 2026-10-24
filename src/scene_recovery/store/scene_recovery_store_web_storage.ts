import {
  sceneRecoverySnapshotParse,
  type SceneRecoverySnapshot,
} from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';
import { SceneRecoveryStore, type SceneRecoveryStoreWriteResult } from './scene_recovery_store.js';

/** Storage key of the recovery snapshot. */
export const SCENE_RECOVERY_STORAGE_KEY = 'bevybroom.scene_recovery';

/**
 * Keeps the recovery snapshot in the editor's web storage, which persists in
 * both the browser and the desktop app.
 */
export class SceneRecoveryStoreWebStorage extends SceneRecoveryStore {
  private readonly storage: Storage | null;
  private readonly storageKey: string;

  /**
   * Creates the store.
   *
   * @param storage Web storage to use, or null when none is available.
   * @param storageKey Key the snapshot is kept under.
   */
  constructor(storage: Storage | null, storageKey: string = SCENE_RECOVERY_STORAGE_KEY) {
    super();
    this.storage = storage;
    this.storageKey = storageKey;
  }

  /**
   * Replaces the kept snapshot.
   *
   * @param snapshot Snapshot to keep.
   * @returns Whether the snapshot was written, with the reason when not.
   */
  snapshotWrite(snapshot: SceneRecoverySnapshot): SceneRecoveryStoreWriteResult {
    if (this.storage === null) {
      return { ok: false, message: 'no storage is available for recovery snapshots' };
    }
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Returns the kept snapshot.
   *
   * @returns The snapshot, or null when none is kept or it is unreadable.
   */
  snapshotRead(): SceneRecoverySnapshot | null {
    const text = this.storage?.getItem(this.storageKey) ?? null;
    return text === null ? null : sceneRecoverySnapshotParse(text);
  }

  /** Removes the kept snapshot. */
  snapshotClear(): void {
    this.storage?.removeItem(this.storageKey);
  }
}

/**
 * Returns the window's local storage when the environment allows it.
 *
 * @returns Local storage, or null when unavailable or blocked.
 */
export function sceneRecoveryLocalStorageRead(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
