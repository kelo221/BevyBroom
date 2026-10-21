import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { GAME_ENTITY_UNKNOWN_COLOR, GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import { testClassesInstall, testDoorClassCreate } from '../game_entity_test_classes.js';

/**
 * Returns the marker color of a game entity after the marker had its chance to
 * follow class and component changes, as before drawing.
 *
 * @param owner Game entity owner.
 * @returns Marker color as 0xRRGGBB.
 */
function markerColor(owner: THREE.Object3D): number {
  GameEntityVisualBuilder.refresh(owner);
  const material = GameEntityOwner.markerOf(owner)?.material;
  return material instanceof THREE.MeshBasicMaterial ? material.color.getHex() : -1;
}

/**
 * Game entities are empty points registered as an entity kind; they start with
 * their class, show a marker in the class color and keep their components when
 * duplicated.
 */
describe('GameEntityOwner', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('is found by kind and through any of its owners', () => {
    const owner = GameEntityOwner.createDefault('Point');
    expect(EntityOwnerRegistry.findByKind(GameEntityOwner.kind)).toBe(GameEntityOwner);
    expect(EntityOwnerRegistry.find(owner)).toBe(GameEntityOwner);
  });

  it('starts with its class attached with every default', () => {
    const door = testDoorClassCreate();
    const owner = gameEntityCreateForClass(door);
    expect(owner.name).toBe(door.label);
    expect(GameEntityComponentStore.read(owner)).toEqual({ [door.type_path]: {} });
    expect(GameEntityOwner.markerOf(owner)).not.toBeNull();
  });

  it('tints the marker with the class color once the class is known', () => {
    const door = testDoorClassCreate();
    const owner = gameEntityCreateForClass(door);
    const unknownColor = markerColor(owner);
    expect(unknownColor).toBe(GAME_ENTITY_UNKNOWN_COLOR);
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    expect(markerColor(owner)).toBe(GameEntityVisualBuilder.colorOf(owner));
    expect(markerColor(owner)).not.toBe(GAME_ENTITY_UNKNOWN_COLOR);
  });

  it('keeps independent components on duplicates', () => {
    const parent = new THREE.Group();
    const owner = gameEntityCreateForClass(testDoorClassCreate());
    parent.add(owner);
    const command = new CommandEntityDuplicate([owner]);
    new CommandStack(4).push(command);
    const [clone] = command.getClonedOwners();
    expect(clone && GameEntityComponentStore.read(clone)).toEqual(GameEntityComponentStore.read(owner));
    GameEntityComponentStore.write(owner, {});
    expect(clone && GameEntityComponentStore.hasAny(clone)).toBe(true);
  });
});
