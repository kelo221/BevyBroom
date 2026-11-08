import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildExportScene } from '@/io/scene/builder_export_scene.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';
import { SprinkleMark, SPRINKLE_MARK_USERDATA_KEY } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { SPRINKLE_TEST_DEFINITION_NAME } from '../sprinkle_test_support.js';

/**
 * Builds a world holding one sprinkled and one hand-placed game entity.
 *
 * @returns World and both entities.
 */
function markTestWorldCreate(): { world: THREE.Group; sprinkled: THREE.Group; placed: THREE.Group } {
  const world = new THREE.Group();
  const sprinkled = GameEntityOwner.createDefault('Sprinkled');
  const placed = GameEntityOwner.createDefault('Placed');
  SprinkleMark.write(sprinkled, SPRINKLE_TEST_DEFINITION_NAME);
  world.add(sprinkled, placed);
  return { world, sprinkled, placed };
}

/**
 * Returns whether any node of a tree carries the sprinkle mark in its userData.
 *
 * @param root Tree root.
 * @returns True when a node carries the mark key.
 */
function markKeyFoundUnder(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((node) => {
    found = found || Object.hasOwn(node.userData, SPRINKLE_MARK_USERDATA_KEY);
  });
  return found;
}

/** The Sprinkle mark survives save and load and duplication but never export. */
describe('ObjectDataContributorSprinkleMark', () => {
  it('keeps the mark on sprinkled entities only through a scene file round trip', () => {
    const { world, sprinkled, placed } = markTestWorldCreate();
    const sceneJson = JSON.parse(JSON.stringify(new SceneSerializer().serialize(world)));
    const loadedWorld = new THREE.Group();
    new SceneDeserializer().deserialize(sceneJson, loadedWorld);
    const loadedSprinkled = loadedWorld.getObjectByProperty('uuid', sprinkled.uuid);
    const loadedPlaced = loadedWorld.getObjectByProperty('uuid', placed.uuid);
    if (!loadedSprinkled || !loadedPlaced) throw new Error('entities not loaded');
    expect(SprinkleMark.read(loadedSprinkled)).toBe(SPRINKLE_TEST_DEFINITION_NAME);
    expect(SprinkleMark.is(loadedPlaced)).toBe(false);
  });

  it('copies the mark onto duplicates', () => {
    const { sprinkled } = markTestWorldCreate();
    const copy = GameEntityOwner.createDefault('Copy');
    ObjectDataContributorRegistry.duplicateDataCopy(sprinkled, copy);
    expect(SprinkleMark.read(copy)).toBe(SPRINKLE_TEST_DEFINITION_NAME);
  });

  it('leaves the mark out of exported scenes', () => {
    const { world } = markTestWorldCreate();
    const exported = buildExportScene(world, { includeGameComponents: true });
    expect(exported.children.length).toBeGreaterThan(0);
    expect(markKeyFoundUnder(exported)).toBe(false);
  });
});
