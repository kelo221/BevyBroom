import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import {
  type GameEntityComponents,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';

/** One object with its overrides before and after the edit. */
interface GameEntityComponentsChange {
  readonly object: THREE.Object3D;
  readonly before: GameEntityComponents;
  readonly after: GameEntityComponents;
}

/**
 * Undoable change of the game components of one or more objects. Each object
 * keeps its own before and after overrides, so multi-selection edits restore
 * exactly.
 */
export class CommandGameEntityComponentsSet implements UndoCommand {
  private readonly changes: GameEntityComponentsChange[];

  /**
   * Captures current overrides and computes new ones per object.
   *
   * @param objects Objects to edit.
   * @param edit Produces the new overrides from an object's current overrides.
   */
  constructor(objects: readonly THREE.Object3D[], edit: (current: GameEntityComponents) => GameEntityComponents) {
    this.changes = [];
    for (const object of objects) {
      this.changeAppend(object, edit);
    }
  }

  /**
   * Returns whether the command changes any object.
   *
   * @returns True when at least one object's overrides differ.
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  /** Applies the new overrides to every object. */
  execute(): void {
    for (const change of this.changes) {
      GameEntityComponentStore.write(change.object, change.after);
    }
  }

  /** Restores every object's previous overrides. */
  undo(): void {
    for (const change of this.changes) {
      GameEntityComponentStore.write(change.object, change.before);
    }
  }

  /**
   * Records one object when the edit changes its overrides.
   *
   * @param object Scene object.
   * @param edit Produces the new overrides.
   */
  private changeAppend(object: THREE.Object3D, edit: (current: GameEntityComponents) => GameEntityComponents): void {
    const before = GameEntityComponentStore.read(object);
    const after = GameEntityComponentStore.fromUnknown(edit(GameEntityComponentStore.read(object)));
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      this.changes.push({ object, before, after });
    }
  }
}
