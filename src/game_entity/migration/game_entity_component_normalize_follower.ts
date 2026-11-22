import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentNormalizer } from '@/game_entity/migration/game_entity_component_normalizer.js';
import { GameEntityComponentRewriteLog } from '@/game_entity/migration/game_entity_component_rewrite_log.js';

/**
 * Keeps every object's game components up to the current classes while a level
 * is open: after every recorded edit, as part of the same undo entry, and as an
 * edit of its own when the classes change. Renames are remembered for the
 * Issues list; values written in for new objects are not.
 */
export class GameEntityComponentNormalizeFollower {
  private readonly worldObject: THREE.Object3D;

  /**
   * Creates the follower.
   *
   * @param worldObject Scene root holding the objects.
   */
  constructor(worldObject: THREE.Object3D) {
    this.worldObject = worldObject;
  }

  /**
   * Follows the recorded edits of a command stack and the class registry.
   *
   * @param commandStack Stack receiving the normalizing edits.
   * @returns Function that stops following.
   */
  follow(commandStack: CommandStack): () => void {
    const followUpRemove = commandStack.followUpProviderAdd(() => this.normalizeCommandCreate());
    const registryRemove = GameEntityClassRegistry.changeListenerAdd(() => {
      const command = this.normalizeCommandCreate();
      if (command !== null) {
        commandStack.push(command);
      }
    });
    return () => {
      followUpRemove();
      registryRemove();
    };
  }

  /**
   * Returns the edit that brings every object's components up to the current
   * classes, remembering its renames, without running it.
   *
   * @returns Edit, or null when every object is current.
   */
  normalizeCommandCreate(): UndoCommand | null {
    const normalizer = GameEntityComponentNormalizer.current();
    const outdated: THREE.Object3D[] = [];
    this.worldObject.traverse((object) => {
      const rewrites = GameEntityComponentStore.hasAny(object)
        ? normalizer.normalize(GameEntityComponentStore.read(object)).rewrites
        : [];
      if (rewrites.length > 0) {
        outdated.push(object);
        GameEntityComponentRewriteLog.record(
          object,
          rewrites.filter((rewrite) => rewrite.kind !== 'default'),
        );
      }
    });
    if (outdated.length === 0) {
      return null;
    }
    return new CommandGameEntityComponentsSet(outdated, (current) => normalizer.normalize(current).components);
  }
}
