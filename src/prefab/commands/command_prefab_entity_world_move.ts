import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { CommandGameEntityLogicSet } from '@/game_entity/logic/command_game_entity_logic_set.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';

/**
 * Undoable Hammer++ `toWorld`: strips the game components and entity I/O
 * outputs from objects so they become plain world geometry. Undo restores
 * both.
 */
export class CommandPrefabEntityWorldMove extends CommandUndoBatch {
  /**
   * Builds the move for objects, or returns null when none carries entity data.
   *
   * @param objects Selected entity groups or objects.
   * @returns World move command, or null when it would change nothing.
   */
  static create(objects: readonly THREE.Object3D[]): CommandPrefabEntityWorldMove | null {
    const steps: UndoCommand[] = [];
    const componentsClear = new CommandGameEntityComponentsSet(objects, () => ({}));
    if (componentsClear.hasChanges()) {
      steps.push(componentsClear);
    }
    steps.push(...CommandPrefabEntityWorldMove.logicClearStepsCreate(objects));
    return steps.length > 0 ? new CommandPrefabEntityWorldMove(steps) : null;
  }

  /**
   * Builds one output-clearing step per object that has entity I/O outputs.
   *
   * @param objects Objects to clear.
   * @returns Logic clearing steps.
   */
  private static logicClearStepsCreate(objects: readonly THREE.Object3D[]): UndoCommand[] {
    return objects
      .filter((object) => GameEntityLogicStore.read(object).length > 0)
      .map((object) => new CommandGameEntityLogicSet(object, []));
  }
}
