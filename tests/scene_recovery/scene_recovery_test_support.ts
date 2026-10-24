import type { UndoCommand } from '@/commands/command_undo.js';
import type { SceneRecoverySnapshot } from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';
import { SceneRecoveryStore, type SceneRecoveryStoreWriteResult } from '@/scene_recovery/store/scene_recovery_store.js';

/** Recovery store kept in memory, which can be told to refuse writes. */
export class SceneRecoveryStoreMemory extends SceneRecoveryStore {
  snapshot: SceneRecoverySnapshot | null = null;
  writeCount = 0;
  refusalMessage: string | null = null;

  /**
   * Keeps the snapshot unless writes are being refused.
   *
   * @param snapshot Snapshot to keep.
   * @returns Whether the snapshot was written.
   */
  snapshotWrite(snapshot: SceneRecoverySnapshot): SceneRecoveryStoreWriteResult {
    if (this.refusalMessage !== null) {
      return { ok: false, message: this.refusalMessage };
    }
    this.snapshot = snapshot;
    this.writeCount += 1;
    return { ok: true };
  }

  /**
   * Returns the kept snapshot.
   *
   * @returns The snapshot, or null.
   */
  snapshotRead(): SceneRecoverySnapshot | null {
    return this.snapshot;
  }

  /** Removes the kept snapshot. */
  snapshotClear(): void {
    this.snapshot = null;
  }
}

/**
 * Creates an undoable command that changes nothing, standing for one edit.
 *
 * @returns The command.
 */
export function sceneRecoveryTestCommandCreate(): UndoCommand {
  return { execute: () => undefined, undo: () => undefined };
}
