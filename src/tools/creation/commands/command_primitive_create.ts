import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';

/**
 * Undoable command for creating a scene object such as a primitive mesh or a
 * light. Execute adds the object to its parent; undo removes it without
 * disposing. Resources are preserved so that redo can re-add the object.
 */
export class CommandPrimitiveCreate implements UndoCommand {
  private object: THREE.Object3D;
  private parent: THREE.Object3D;

  /**
   * Creates an object create command.
   *
   * @param object The object to be added to the parent.
   * @param parent The parent object to which the object will be added.
   */
  constructor(object: THREE.Object3D, parent: THREE.Object3D) {
    this.object = object;
    this.parent = parent;
  }

  /**
   * Executes the command by adding the object to the parent. No-op if the
   * object already has a parent.
   */
  execute(): void {
    if (this.object.parent) return;
    this.parent.add(this.object);
  }

  /**
   * Undoes the command by removing the object from its parent. Does not dispose
   * geometry or material so redo remains possible.
   */
  undo(): void {
    if (this.object.parent) {
      this.object.parent.remove(this.object);
    }
  }
}
