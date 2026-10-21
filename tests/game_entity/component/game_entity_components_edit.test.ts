import { describe, expect, it } from 'vitest';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { TEST_DOOR_TYPE_PATH, testDoorClassCreate } from '../game_entity_test_classes.js';

/**
 * Edits store only real changes: values equal to the class default remove the
 * override, and the resolver falls back to defaults for every field not
 * overridden.
 */
describe('GameEntityComponentsEdit and GameEntityComponentResolver', () => {
  const door = testDoorClassCreate();
  const speed = GameEntityComponentResolver.fieldFind(door, 'speed');
  const angle = GameEntityComponentResolver.fieldFind(door, 'hinge.angle');

  it('finds fields inside groups and skips the groups themselves', () => {
    expect(angle?.path).toBe('hinge.angle');
    expect(GameEntityComponentResolver.fieldFind(door, 'hinge')).toBeNull();
    const leafPaths = GameEntityComponentResolver.fieldsLeaf(door.fields).map((field) => field.path);
    expect(leafPaths).toContain('hinge.angle');
    expect(leafPaths).not.toContain('hinge');
  });

  it('stores an override and removes it again when set back to the default', () => {
    if (!speed) throw new Error('the door has a speed');
    const added = GameEntityComponentsEdit.componentAdd({}, TEST_DOOR_TYPE_PATH);
    const changed = GameEntityComponentsEdit.fieldSet(added, TEST_DOOR_TYPE_PATH, speed, (speed.default as number) + 1);
    expect(GameEntityComponentResolver.isOverridden(changed, TEST_DOOR_TYPE_PATH, 'speed')).toBe(true);
    expect(GameEntityComponentResolver.valueEffective(changed, TEST_DOOR_TYPE_PATH, speed)).toBe(
      (speed.default as number) + 1,
    );
    const restored = GameEntityComponentsEdit.fieldSet(changed, TEST_DOOR_TYPE_PATH, speed, speed.default);
    expect(restored).toEqual(added);
    expect(GameEntityComponentResolver.valueEffective(restored, TEST_DOOR_TYPE_PATH, speed)).toBe(speed.default);
  });

  it('ignores values that do not fit and leaves the input untouched', () => {
    if (!speed) throw new Error('the door has a speed');
    const before = { [TEST_DOOR_TYPE_PATH]: { speed: 4 } };
    const snapshot = structuredClone(before);
    expect(GameEntityComponentsEdit.fieldSet(before, TEST_DOOR_TYPE_PATH, speed, 'fast')).toEqual(snapshot);
    GameEntityComponentsEdit.fieldReset(before, TEST_DOOR_TYPE_PATH, 'speed');
    GameEntityComponentsEdit.componentRemove(before, TEST_DOOR_TYPE_PATH);
    expect(before).toEqual(snapshot);
  });

  it('removes a component with its overrides and resets single fields', () => {
    const components = { [TEST_DOOR_TYPE_PATH]: { speed: 4, locked: true }, other: {} };
    expect(GameEntityComponentsEdit.fieldReset(components, TEST_DOOR_TYPE_PATH, 'speed')).toEqual({
      [TEST_DOOR_TYPE_PATH]: { locked: true },
      other: {},
    });
    expect(GameEntityComponentsEdit.componentRemove(components, TEST_DOOR_TYPE_PATH)).toEqual({ other: {} });
  });
});
