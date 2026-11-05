import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { GameEntityLogicStore } from './game_entity_logic_store.js';
import type { AuthoredLogicOutput } from './game_entity_logic_types.js';

/**
 * Undoable command that replaces the authored entity I/O output rows on a scene
 * object.
 */
export class CommandGameEntityLogicSet implements UndoCommand {
  private readonly targetObject: THREE.Object3D;
  private readonly beforeRows: AuthoredLogicOutput[];
  private readonly afterRows: AuthoredLogicOutput[];
  private readonly onApplied: (() => void) | undefined;

  /**
   * Creates a command to set an object's logic output rows.
   *
   * @param targetObject Scene object to modify.
   * @param nextRows New output rows.
   * @param onApplied Optional callback invoked after execute or undo.
   */
  constructor(targetObject: THREE.Object3D, nextRows: readonly AuthoredLogicOutput[], onApplied?: () => void) {
    this.targetObject = targetObject;
    this.beforeRows = GameEntityLogicStore.read(targetObject);
    this.afterRows = nextRows.map((row) => GameEntityLogicStore.rowSanitize(row));
    this.onApplied = onApplied;
  }

  /** Applies the new logic output rows. */
  execute(): void {
    GameEntityLogicStore.write(this.targetObject, this.afterRows);
    this.onApplied?.();
  }

  /** Restores the previous logic output rows. */
  undo(): void {
    GameEntityLogicStore.write(this.targetObject, this.beforeRows);
    this.onApplied?.();
  }
}
