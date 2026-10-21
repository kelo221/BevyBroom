import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GAME_ENTITY_COMPONENTS_USERDATA_KEY,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';
import { TEST_DOOR_TYPE_PATH } from '../game_entity_test_classes.js';

/**
 * Component overrides live in userData of any object; reads and writes copy
 * them, keep data of classes the editor does not know and drop values that
 * cannot travel to the game.
 */
describe('GameEntityComponentStore', () => {
  it('round trips overrides as independent copies', () => {
    const object = new THREE.Mesh();
    const components = { [TEST_DOOR_TYPE_PATH]: { speed: 4, open_offset: [0, 1, 0] } };
    GameEntityComponentStore.write(object, components);
    const read = GameEntityComponentStore.read(object);
    expect(read).toEqual(components);
    const speedOverrides = read[TEST_DOOR_TYPE_PATH];
    if (speedOverrides) {
      speedOverrides['speed'] = 99;
    }
    expect(GameEntityComponentStore.read(object)).toEqual(components);
  });

  it('keeps unknown classes and drops values that cannot travel', () => {
    const object = new THREE.Group();
    object.userData[GAME_ENTITY_COMPONENTS_USERDATA_KEY] = {
      'other_game::Unknown': { anything: 'kept' },
      [TEST_DOOR_TYPE_PATH]: { speed: Number.NaN, nested: { deep: { value: 1 } }, locked: true },
      '': { blank: 1 },
    };
    expect(GameEntityComponentStore.read(object)).toEqual({
      'other_game::Unknown': { anything: 'kept' },
      [TEST_DOOR_TYPE_PATH]: { locked: true },
    });
  });

  it('removes the userData key when no component is left', () => {
    const object = new THREE.Group();
    GameEntityComponentStore.write(object, { [TEST_DOOR_TYPE_PATH]: {} });
    expect(GameEntityComponentStore.hasAny(object)).toBe(true);
    GameEntityComponentStore.write(object, {});
    expect(GameEntityComponentStore.hasAny(object)).toBe(false);
    expect(GAME_ENTITY_COMPONENTS_USERDATA_KEY in object.userData).toBe(false);
  });

  it('gives cloned objects their own copy of the overrides', () => {
    const object = new THREE.Group();
    GameEntityComponentStore.write(object, { [TEST_DOOR_TYPE_PATH]: { speed: 2 } });
    const clone = object.clone();
    GameEntityComponentStore.write(object, { [TEST_DOOR_TYPE_PATH]: { speed: 8 } });
    expect(GameEntityComponentStore.read(clone)).toEqual({ [TEST_DOOR_TYPE_PATH]: { speed: 2 } });
  });
});
