import type * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/** One object and the visibility a command gives it. */
export interface ObjectVisibilityChange {
  /** Object whose visibility changes. */
  object: THREE.Object3D;
  /** Visibility after the command runs. */
  visible: boolean;
}

/**
 * Undoable change of the visibility of several objects. Solid brushes also
 * leave or re-enter CSG evaluation through the partial rebuild path.
 */
export class CommandObjectsVisibilitySet implements UndoCommand {
  private readonly changes: ObjectVisibilityChange[];
  private readonly previousVisibility: boolean[];
  private executed = false;

  /**
   * Creates a visibility command.
   *
   * @param changes Objects with the visibility each one receives.
   */
  constructor(changes: readonly ObjectVisibilityChange[]) {
    this.changes = changes.slice();
    this.previousVisibility = changes.map((change) => change.object.visible);
  }

  /** Applies the new visibility of every object. */
  execute(): void {
    if (this.executed) {
      return;
    }
    this.changes.forEach((change) => this.objectVisibilityApply(change.object, change.visible));
    this.executed = true;
  }

  /** Restores the previous visibility of every object. */
  undo(): void {
    this.changes.forEach((change, index) =>
      this.objectVisibilityApply(change.object, this.previousVisibility[index] ?? change.object.visible),
    );
    this.executed = false;
  }

  /**
   * Returns how many objects the command changes.
   *
   * @returns Changed object count.
   */
  getChangedObjectCount(): number {
    return this.changes.length;
  }

  /**
   * Sets one object's visibility and updates its CSG membership when it is a
   * solid brush.
   *
   * @param object Object to change.
   * @param visible New visibility.
   */
  private objectVisibilityApply(object: THREE.Object3D, visible: boolean): void {
    object.visible = visible;
    SolidModel.fromObject(object)?.applyBrushVisibilityChange(object);
  }
}
