import type * as THREE from 'three';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import {
  type GameEntityComponents,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';

/**
 * Copy and Paste of the Object Properties dialog: holds the game component
 * values of one object and builds the command that gives them to others.
 */
export class ObjectPropertiesComponentClipboard {
  private copiedComponents: GameEntityComponents | null;

  /** Creates an empty clipboard. */
  constructor() {
    this.copiedComponents = null;
  }

  /**
   * Returns whether anything was copied.
   *
   * @returns True after a copy.
   */
  hasContent(): boolean {
    return this.copiedComponents !== null;
  }

  /**
   * Copies the game component values of an object.
   *
   * @param object Object whose components are copied.
   */
  copy(object: THREE.Object3D): void {
    this.copiedComponents = GameEntityComponentStore.read(object);
  }

  /**
   * Builds the command that replaces the components of the objects with the
   * copied ones; the command stores its own copy for every object.
   *
   * @param objects Objects that receive the copied components.
   * @returns Command, or null when nothing was copied or nothing would change.
   */
  pasteCommandCreate(objects: readonly THREE.Object3D[]): CommandGameEntityComponentsSet | null {
    const copiedComponents = this.copiedComponents;
    if (!copiedComponents) {
      return null;
    }
    const command = new CommandGameEntityComponentsSet(objects, () => copiedComponents);
    return command.hasChanges() ? command : null;
  }
}
