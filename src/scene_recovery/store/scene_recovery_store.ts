import type { SceneRecoverySnapshot } from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';

/** Outcome of writing a recovery snapshot. */
export type SceneRecoveryStoreWriteResult = { ok: true } | { ok: false; message: string };

/** Place that keeps one recovery snapshot across editor sessions. */
export abstract class SceneRecoveryStore {
  /**
   * Replaces the kept snapshot. A failed write keeps the previous snapshot.
   *
   * @param snapshot Snapshot to keep.
   * @returns Whether the snapshot was written, with the reason when not.
   */
  abstract snapshotWrite(snapshot: SceneRecoverySnapshot): SceneRecoveryStoreWriteResult;

  /**
   * Returns the kept snapshot.
   *
   * @returns The snapshot, or null when none is kept or it is unreadable.
   */
  abstract snapshotRead(): SceneRecoverySnapshot | null;

  /** Removes the kept snapshot. */
  abstract snapshotClear(): void;
}
