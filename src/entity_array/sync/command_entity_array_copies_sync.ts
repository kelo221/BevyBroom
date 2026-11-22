import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';

/** The copies one array source loses and gains. */
export interface EntityArrayCopiesChange {
  /** Array source the copies stand under. */
  readonly source: THREE.Object3D;
  /** Copies taken away. */
  readonly removed: readonly THREE.Object3D[];
  /** Copies put under the source. */
  readonly added: readonly THREE.Object3D[];
}

/**
 * Undoable command that replaces the copies of array sources. Changes run in
 * order and are undone in reverse; the same copies come back on redo, so their
 * identifiers stay stable.
 */
export class CommandEntityArrayCopiesSync implements UndoCommand {
  private readonly changes: readonly EntityArrayCopiesChange[];

  /**
   * Creates the command.
   *
   * @param changes Copies to take away and put in, per source.
   */
  constructor(changes: readonly EntityArrayCopiesChange[]) {
    this.changes = changes.slice();
  }

  /** Takes the old copies away and puts the new ones in. */
  execute(): void {
    this.changes.forEach((change) => CommandEntityArrayCopiesSync.copiesSwap(change, change.removed, change.added));
  }

  /** Takes the new copies away and puts the old ones back. */
  undo(): void {
    for (let index = this.changes.length - 1; index >= 0; index--) {
      const change = this.changes[index];
      if (change !== undefined) {
        CommandEntityArrayCopiesSync.copiesSwap(change, change.added, change.removed);
      }
    }
  }

  /**
   * Takes copies away from a source and puts others under it.
   *
   * @param change Change holding the source.
   * @param outgoing Copies to take away.
   * @param incoming Copies to put under the source.
   */
  private static copiesSwap(
    change: EntityArrayCopiesChange,
    outgoing: readonly THREE.Object3D[],
    incoming: readonly THREE.Object3D[],
  ): void {
    outgoing.forEach((copy) => copy.removeFromParent());
    incoming.forEach((copy) => change.source.add(copy));
  }
}
