import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityVisualVolumeOverlay } from '@/game_entity/visual/volume/game_entity_visual_volume_overlay.js';

/**
 * Gives every mesh in the scene the volume marker drawing its classes ask for,
 * checking all meshes again whenever the undo history or the classes change.
 */
export class GameEntityVisualVolumeFollower {
  private readonly worldObject: THREE.Object3D;

  /**
   * Creates the follower.
   *
   * @param worldObject Scene root holding the volumes.
   */
  constructor(worldObject: THREE.Object3D) {
    this.worldObject = worldObject;
  }

  /**
   * Follows the changes of a command stack and the class registry.
   *
   * @param commandStack Stack whose changes trigger a check.
   * @returns Function that stops following.
   */
  follow(commandStack: CommandStack): () => void {
    const stackChanged = (): void => this.refreshAll();
    commandStack.onStackChanged(stackChanged);
    const registryRemove = GameEntityClassRegistry.changeListenerAdd(stackChanged);
    return () => {
      commandStack.offStackChanged(stackChanged);
      registryRemove();
    };
  }

  /** Brings the volume marker drawing of every mesh in the scene in step. */
  refreshAll(): void {
    const candidates: THREE.Object3D[] = [];
    this.worldObject.traverse((object) => {
      if (GameEntityVisualVolumeOverlay.volumeCandidateIs(object)) {
        candidates.push(object);
      }
    });
    candidates.forEach((object) => GameEntityVisualVolumeOverlay.refresh(object));
  }
}
