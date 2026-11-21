import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityFixtureLightBuilder } from '@/game_entity/fixture_light/game_entity_fixture_light_builder.js';
import { GameEntityFixtureLightMark } from '@/game_entity/fixture_light/game_entity_fixture_light_mark.js';
import { GameEntityFixtureLightSpecResolver } from '@/game_entity/fixture_light/game_entity_fixture_light_spec.js';
import {
  CommandGameEntityFixtureLightsSync,
  type GameEntityFixtureLightChange,
} from '@/game_entity/fixture_light/command_game_entity_fixture_lights_sync.js';

/**
 * Keeps the lights entities carry because of their variants in step with the
 * variants, as part of every recorded edit: an entity whose variant declares a
 * light gets one, a light made from an earlier variant is made again from the
 * new one, and it goes when the variant declares none. A light keeps the
 * designer's edits while its variant stays the same; lights the designer added
 * are never touched.
 */
export class GameEntityFixtureLightFollower {
  private readonly worldObject: THREE.Object3D;

  /**
   * Creates the follower.
   *
   * @param worldObject Scene root holding the entities.
   */
  constructor(worldObject: THREE.Object3D) {
    this.worldObject = worldObject;
  }

  /**
   * Makes every recorded edit of a command stack bring the lights in step.
   *
   * @param commandStack Stack whose recorded edits are followed.
   * @returns Function that stops following.
   */
  follow(commandStack: CommandStack): () => void {
    return commandStack.followUpProviderAdd(() => this.syncCommandCreate());
  }

  /**
   * Returns the command that brings every entity's lights in step, without
   * running it.
   *
   * @returns Command, or null when every entity already matches its variant.
   */
  syncCommandCreate(): UndoCommand | null {
    const changes = GameEntityOwner.collectUnder(this.worldObject).flatMap((owner) => this.ownerChangesOf(owner));
    return changes.length === 0 ? null : new CommandGameEntityFixtureLightsSync(changes);
  }

  /**
   * Returns the changes one entity needs.
   *
   * @param owner Game entity owner.
   * @returns Removal of marked lights from another variant, then the new light
   *   when the variant declares one and none is there yet.
   */
  private ownerChangesOf(owner: THREE.Object3D): GameEntityFixtureLightChange[] {
    const spec = GameEntityFixtureLightSpecResolver.specOf(owner);
    const marked = GameEntityFixtureLightMark.childrenMarked(owner);
    const stale = marked.filter((light) => GameEntityFixtureLightMark.read(light) !== spec?.variantKey);
    const changes = stale.map((light) => ({ owner, light, isAdded: false }));
    if (spec !== null && stale.length === marked.length) {
      const light = GameEntityFixtureLightBuilder.lightCreate(owner, spec, this.worldObject);
      changes.push({ owner, light, isAdded: true });
    }
    return changes;
  }
}
