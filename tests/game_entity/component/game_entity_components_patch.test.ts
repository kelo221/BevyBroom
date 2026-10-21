import { afterEach, describe, expect, it } from 'vitest';
import { gameEntityComponentsPatchApply } from '@/game_entity/component/game_entity_components_patch.js';
import {
  TEST_DOOR_TYPE_PATH,
  TEST_SPINNER_TYPE_PATH,
  testClassesInstall,
  testDoorField,
} from '../game_entity_test_classes.js';

/**
 * Component patches attach, set and remove components, store only real
 * overrides and report every part that does not fit the known classes.
 */
describe('gameEntityComponentsPatchApply', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('attaches listed components, sets fields and removes null components', () => {
    cleanups.push(testClassesInstall().uninstall);
    const speedDefault = Number(testDoorField('speed').default);
    const result = gameEntityComponentsPatchApply(
      { [TEST_SPINNER_TYPE_PATH]: { speed: 3 } },
      {
        [TEST_DOOR_TYPE_PATH]: { speed: speedDefault + 1, uses: testDoorField('uses').default },
        [TEST_SPINNER_TYPE_PATH]: null,
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.components).toEqual({ [TEST_DOOR_TYPE_PATH]: { speed: speedDefault + 1 } });
  });

  it('reports unknown classes, unknown fields, groups and values of the wrong kind', () => {
    cleanups.push(testClassesInstall().uninstall);
    const original = { [TEST_DOOR_TYPE_PATH]: {} };
    const result = gameEntityComponentsPatchApply(original, {
      'other_game::Lever': {},
      [TEST_DOOR_TYPE_PATH]: { wobble: 1, hinge: {}, speed: 'fast', locked: true },
    });
    expect(result.errors).toHaveLength(4);
    expect(result.components).toEqual({ [TEST_DOOR_TYPE_PATH]: { locked: true } });
    expect(original).toEqual({ [TEST_DOOR_TYPE_PATH]: {} });
  });
});
