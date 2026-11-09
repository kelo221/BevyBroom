import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { SprinkleEntityFactory, sprinkleComponentsMerge } from '@/tools/sprinkle/placement/sprinkle_entity_factory.js';
import { TEST_DOOR_TYPE_PATH, TEST_SPINNER_TYPE_PATH } from '../../../game_entity/game_entity_test_classes.js';
import {
  SPRINKLE_TEST_CASE_COMPONENTS,
  SPRINKLE_TEST_DEFINITION_NAME,
  SPRINKLE_TEST_DOOR_CLASS_ID,
  sprinkleTestCaseCreate,
  sprinkleTestLibraryInstall,
} from '../sprinkle_test_support.js';

/** Instantiation of sprinkle definition cases as marked entities. */
describe('SprinkleEntityFactory', () => {
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = sprinkleTestLibraryInstall();
  });

  afterEach(() => {
    uninstall();
  });

  it('resolves point classes by entity class id and rejects unknown class ids', () => {
    expect(SprinkleEntityFactory.pointClassResolve(SPRINKLE_TEST_DOOR_CLASS_ID)?.id).toBe(SPRINKLE_TEST_DOOR_CLASS_ID);
    expect(SprinkleEntityFactory.pointClassResolve('no.such.class')).toBeNull();
  });

  it('resolves a bare game type path to the same point class as its entity class id', () => {
    const byClassId = SprinkleEntityFactory.pointClassResolve(SPRINKLE_TEST_DOOR_CLASS_ID);
    const byTypePath = SprinkleEntityFactory.pointClassResolve(TEST_DOOR_TYPE_PATH);
    expect(byTypePath).not.toBeNull();
    expect(byTypePath?.id).toBe(byClassId?.id);
    expect(byTypePath?.id).toBe(SPRINKLE_TEST_DOOR_CLASS_ID);
    expect(SprinkleEntityFactory.pointClassResolve(`${TEST_DOOR_TYPE_PATH}Missing`)).toBeNull();
  });

  it('creates a marked game entity carrying its class and the case overrides at a world transform', () => {
    const pointClass = SprinkleEntityFactory.pointClassResolve(SPRINKLE_TEST_DOOR_CLASS_ID);
    if (!pointClass) throw new Error('door class missing');
    const parent = new THREE.Group();
    parent.position.set(3, -1, 2);
    parent.rotation.set(0, 0.7, 0);
    const position = new THREE.Vector3(1.5, 0.25, -4);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.1);
    const placement = { position, quaternion };
    const entity = SprinkleEntityFactory.entityCreate(
      pointClass,
      sprinkleTestCaseCreate(SPRINKLE_TEST_DOOR_CLASS_ID),
      SPRINKLE_TEST_DEFINITION_NAME,
      placement,
      parent,
    );
    parent.add(entity);
    parent.updateMatrixWorld(true);
    expect(GameEntityOwner.isOwner(entity)).toBe(true);
    expect(SprinkleMark.read(entity)).toBe(SPRINKLE_TEST_DEFINITION_NAME);
    expect(GameEntityComponentStore.read(entity)).toEqual(SPRINKLE_TEST_CASE_COMPONENTS);
    expect(entity.getWorldPosition(new THREE.Vector3()).distanceTo(position)).toBeLessThan(1e-9);
    expect(entity.getWorldQuaternion(new THREE.Quaternion()).angleTo(quaternion)).toBeLessThan(1e-6);
  });

  it('lays case fields over existing components and keeps other components', () => {
    const base = { [TEST_DOOR_TYPE_PATH]: { locked: true, speed: 1 }, [TEST_SPINNER_TYPE_PATH]: {} };
    const merged = sprinkleComponentsMerge(base, { [TEST_DOOR_TYPE_PATH]: { speed: 9 } });
    expect(merged).toEqual({ [TEST_DOOR_TYPE_PATH]: { locked: true, speed: 9 }, [TEST_SPINNER_TYPE_PATH]: {} });
    expect(base[TEST_DOOR_TYPE_PATH].speed).toBe(1);
  });
});
