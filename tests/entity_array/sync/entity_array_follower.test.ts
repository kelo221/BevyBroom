import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { entityPickMeshSelectableIs } from '@/entity/model/entity_owner_keys.js';
import { EntityArrayFootprint } from '@/entity_array/layout/entity_array_footprint.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArraySettingsRules, type EntityArraySettings } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import {
  ENTITY_ARRAY_TEST_SHELF_BOX,
  entityArrayTestPickMeshesOf,
  entityArrayTestRigCreate,
  entityArrayTestSettingsSet,
  entityArrayTestShelfPlace,
} from '../entity_array_test_rig.js';

/**
 * Returns array settings with the given counts and gaps.
 *
 * @param counts Objects along X, Y and Z, the source included.
 * @param gap Space between neighbours along X, Y and Z.
 * @returns Valid settings.
 */
function settingsOf(counts: [number, number, number], gap: [number, number, number]): EntityArraySettings {
  const settings = EntityArraySettingsRules.fromUnknown({
    count_x: counts[0],
    count_y: counts[1],
    count_z: counts[2],
    gap,
  });
  if (settings === null) {
    throw new Error('array settings are an object');
  }
  return settings;
}

/**
 * Returns the world positions of the copies of a source, sorted along X then Z.
 *
 * @param source Array source.
 * @returns World positions.
 */
function copyWorldPositions(source: THREE.Object3D): THREE.Vector3[] {
  source.updateWorldMatrix(true, true);
  return EntityArrayCopyMark.copiesOf(source)
    .map((copy) => copy.getWorldPosition(new THREE.Vector3()))
    .sort((a, b) => a.x - b.x || a.z - b.z);
}

/**
 * Returns the fixture variant of an entity.
 *
 * @param owner Entity owner.
 * @param typePath Component type path.
 * @returns The fixture field value.
 */
function fixtureOf(owner: THREE.Object3D, typePath: string): unknown {
  return GameEntityComponentStore.read(owner)[typePath]?.['fixture'];
}

/**
 * An entity that repeats gets copies of itself along its own axes, spaced by
 * the box it fills plus the gap, rebuilt when its content or settings change
 * and gone when it stops repeating.
 */
describe('EntityArrayFollower', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('measures a fixture by the box its marker fills', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    const size = EntityArrayFootprint.sizeOf(shelf);
    expect(size.toArray()).toEqual(ENTITY_ARRAY_TEST_SHELF_BOX.size);
  });

  it('places one copy per cell, a footprint plus a gap apart, in the same undo step', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const origin = new THREE.Vector3(3, 0, -2);
    const shelf = entityArrayTestShelfPlace(rig, origin);
    const gapX = 0.25;
    entityArrayTestSettingsSet(rig, shelf, settingsOf([4, 1, 1], [gapX, 0, 0]));
    const stepX = ENTITY_ARRAY_TEST_SHELF_BOX.size[0] + gapX;
    const positions = copyWorldPositions(shelf);
    expect(positions).toHaveLength(3);
    positions.forEach((position, index) => {
      expect(position.x).toBeCloseTo(origin.x + stepX * (index + 1), 9);
      expect(position.z).toBeCloseTo(origin.z, 9);
    });
    rig.stack.undo();
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(0);
    expect(EntityArrayStore.read(shelf)).toBeNull();
  });

  it('fills a grid along X and Z and follows the turn of the source', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    shelf.rotation.y = Math.PI / 2;
    const gapZ = 1.5;
    entityArrayTestSettingsSet(rig, shelf, settingsOf([2, 1, 3], [0, 0, gapZ]));
    const copies = EntityArrayCopyMark.copiesOf(shelf);
    expect(copies).toHaveLength(5);
    shelf.updateWorldMatrix(true, true);
    const farCorner = copies.find((copy) => EntityArrayCopyMark.read(copy)?.cell.join() === '1,0,2');
    const expectedLocal = new THREE.Vector3(
      ENTITY_ARRAY_TEST_SHELF_BOX.size[0],
      0,
      2 * (ENTITY_ARRAY_TEST_SHELF_BOX.size[2] + gapZ),
    );
    const expectedWorld = shelf.localToWorld(expectedLocal.clone());
    expect(farCorner?.getWorldPosition(new THREE.Vector3()).distanceTo(expectedWorld)).toBeCloseTo(0, 9);
  });

  it('keeps the copies on redo and rebuilds them only when something they are made from changes', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    entityArrayTestSettingsSet(rig, shelf, settingsOf([3, 1, 1], [0, 0, 0]));
    const firstIds = EntityArrayCopyMark.copiesOf(shelf).map((copy) => copy.uuid);
    rig.stack.undo();
    rig.stack.redo();
    expect(EntityArrayCopyMark.copiesOf(shelf).map((copy) => copy.uuid)).toEqual(firstIds);
    shelf.position.x += 5;
    rig.stack.push(new CommandGameEntityComponentsSet([shelf], () => ({ [rig.shelf.type_path]: { fixture: 'low' } })));
    const rebuilt = EntityArrayCopyMark.copiesOf(shelf);
    expect(rebuilt.map((copy) => copy.uuid)).not.toEqual(firstIds);
    rebuilt.forEach((copy) => expect(fixtureOf(copy, rig.shelf.type_path)).toBe('low'));
    rig.stack.undo();
    EntityArrayCopyMark.copiesOf(shelf).forEach((copy) => expect(fixtureOf(copy, rig.shelf.type_path)).toBe('tall'));
  });

  it('takes the copies away when the entity stops repeating', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    entityArrayTestSettingsSet(rig, shelf, settingsOf([2, 2, 2], [0, 0, 0]));
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(7);
    entityArrayTestSettingsSet(rig, shelf, null);
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(0);
  });

  it('keeps copies from being clicked while the source stays clickable', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    entityArrayTestSettingsSet(rig, shelf, settingsOf([3, 1, 1], [0, 0, 0]));
    const copies = EntityArrayCopyMark.copiesOf(shelf);
    const copyMarkers = copies.flatMap((copy) => entityArrayTestPickMeshesOf(copy));
    expect(copyMarkers.length).toBeGreaterThanOrEqual(copies.length);
    copyMarkers.forEach((marker) => expect(entityPickMeshSelectableIs(marker)).toBe(false));
    const sourceMarkers = entityArrayTestPickMeshesOf(shelf).filter((marker) => !copyMarkers.includes(marker));
    expect(sourceMarkers.length).toBeGreaterThan(0);
    sourceMarkers.forEach((marker) => expect(entityPickMeshSelectableIs(marker)).toBe(true));
  });

  it('gives a duplicated source its own array without building the copies twice', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    entityArrayTestSettingsSet(rig, shelf, settingsOf([3, 1, 1], [0.5, 0, 0]));
    const duplicate = new CommandEntityDuplicate([shelf]);
    rig.stack.push(duplicate);
    const [copyOfShelf] = duplicate.getClonedOwners();
    expect(copyOfShelf).toBeDefined();
    if (copyOfShelf === undefined) {
      return;
    }
    expect(EntityArrayStore.read(copyOfShelf)).toEqual(EntityArrayStore.read(shelf));
    expect(EntityArrayCopyMark.copiesOf(copyOfShelf)).toHaveLength(2);
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(2);
  });
});
