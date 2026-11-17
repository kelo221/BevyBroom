import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { CollisionKind } from '@/level_export/collision/collision_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';

/** One object whose overridden collision kind changes. */
interface CommandCollisionKindChange {
  readonly object: THREE.Object3D;
  readonly before: CollisionKind | null;
}

/** Sets or clears the overridden collision kind of objects as one undo step. */
export class CommandCollisionKindSet implements UndoCommand {
  private readonly changes: CommandCollisionKindChange[];

  /**
   * Creates the command.
   *
   * @param objects Objects to change.
   * @param kind Kind to override with, or null to take the declared one.
   */
  constructor(
    objects: readonly THREE.Object3D[],
    private readonly kind: CollisionKind | null,
  ) {
    this.changes = objects
      .map((object) => ({ object, before: CollisionKindStore.overrideRead(object) }))
      .filter((change) => change.before !== kind);
  }

  /**
   * Returns whether any object changes.
   *
   * @returns True when the command does something.
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  /** Writes the new kind on every object. */
  execute(): void {
    this.changes.forEach((change) => CollisionKindStore.overrideWrite(change.object, this.kind));
  }

  /** Restores each object's previous kind. */
  undo(): void {
    this.changes.forEach((change) => CollisionKindStore.overrideWrite(change.object, change.before));
  }
}
