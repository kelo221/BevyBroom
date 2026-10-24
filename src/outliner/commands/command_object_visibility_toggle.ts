import type * as THREE from 'three';
import { CommandObjectsVisibilitySet } from './command_objects_visibility_set.js';

/**
 * Undoable command for toggling the visibility of one object. Solid brushes
 * also leave or re-enter CSG evaluation via partial rebuild.
 */
export class CommandObjectVisibilityToggle extends CommandObjectsVisibilitySet {
  private readonly newVisibility: boolean;

  /**
   * Creates a new toggle visibility command for the specified object.
   *
   * @param object The Three.js object whose visibility to toggle.
   */
  constructor(object: THREE.Object3D) {
    super([{ object, visible: !object.visible }]);
    this.newVisibility = !object.visible;
  }

  /**
   * Returns the new visibility state set by this command.
   *
   * @returns True if the object is made visible, false otherwise.
   */
  getNewVisibility(): boolean {
    return this.newVisibility;
  }
}
