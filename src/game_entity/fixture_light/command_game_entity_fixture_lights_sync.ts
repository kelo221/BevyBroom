import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';

/** One light added to or removed from an entity. */
export interface GameEntityFixtureLightChange {
  /** Entity the light belongs to. */
  readonly owner: THREE.Object3D;
  /** Light owner added or removed. */
  readonly light: THREE.Object3D;
  /** True to add the light, false to remove it. */
  readonly isAdded: boolean;
}

/**
 * Undoable command that adds and removes the lights entities carry because of
 * their variants. Changes run in order and are undone in reverse.
 */
export class CommandGameEntityFixtureLightsSync implements UndoCommand {
  private readonly changes: readonly GameEntityFixtureLightChange[];

  /**
   * Creates the command.
   *
   * @param changes Lights to add and remove, in order.
   */
  constructor(changes: readonly GameEntityFixtureLightChange[]) {
    this.changes = changes.slice();
  }

  /** Applies every change in order. */
  execute(): void {
    this.changes.forEach((change) => CommandGameEntityFixtureLightsSync.changeApply(change, change.isAdded));
  }

  /** Reverts every change in reverse order. */
  undo(): void {
    for (let index = this.changes.length - 1; index >= 0; index--) {
      const change = this.changes[index];
      if (change !== undefined) {
        CommandGameEntityFixtureLightsSync.changeApply(change, !change.isAdded);
      }
    }
  }

  /**
   * Puts a light under its entity or takes it away.
   *
   * @param change Light and entity.
   * @param isAttached True to put the light under the entity, false to remove
   *   it.
   */
  private static changeApply(change: GameEntityFixtureLightChange, isAttached: boolean): void {
    if (isAttached) {
      change.owner.add(change.light);
    } else {
      change.light.removeFromParent();
    }
  }
}
