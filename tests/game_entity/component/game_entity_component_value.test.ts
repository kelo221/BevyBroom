import { describe, expect, it } from 'vitest';
import {
  gameEntityFieldValueEquals,
  gameEntityFieldValueFromUnknown,
  gameEntityFieldValueNormalize,
} from '@/game_entity/component/game_entity_component_value.js';
import { testDoorField as doorField } from '../game_entity_test_classes.js';

/**
 * Field values are checked against their field before they are stored, so the
 * game only receives values its types accept.
 */
describe('game entity field values', () => {
  it('clamps numbers into the field range and rounds integers', () => {
    const speed = doorField('speed');
    expect(gameEntityFieldValueNormalize(speed, (speed.maximum ?? 0) + 5)).toBe(speed.maximum);
    expect(gameEntityFieldValueNormalize(doorField('uses'), 4.6)).toBe(5);
    expect(gameEntityFieldValueNormalize(speed, Number.NaN)).toBeUndefined();
    expect(gameEntityFieldValueNormalize(speed, '3')).toBeUndefined();
  });

  it('accepts only listed enum variants and asset paths or null', () => {
    const kind = doorField('kind');
    expect(gameEntityFieldValueNormalize(kind, kind.variants?.[1])).toBe(kind.variants?.[1]);
    expect(gameEntityFieldValueNormalize(kind, 'Cardboard')).toBeUndefined();
    expect(gameEntityFieldValueNormalize(doorField('stats'), null)).toBeNull();
    expect(gameEntityFieldValueNormalize(doorField('stats'), 'data/a.door.ron')).toBe('data/a.door.ron');
  });

  it('checks vector sizes and clamps color channels', () => {
    expect(gameEntityFieldValueNormalize(doorField('open_offset'), [1, 2, 3])).toEqual([1, 2, 3]);
    expect(gameEntityFieldValueNormalize(doorField('open_offset'), [1, 2])).toBeUndefined();
    expect(gameEntityFieldValueNormalize(doorField('tint'), [2, 0.5, -1, 1])).toEqual([1, 0.5, 0, 1]);
  });

  it('never edits groups or unsupported fields', () => {
    expect(gameEntityFieldValueNormalize(doorField('hinge'), 1)).toBeUndefined();
    expect(gameEntityFieldValueNormalize(doorField('pending'), 1)).toBeUndefined();
  });

  it('reads stored values that can travel and rejects others', () => {
    expect(gameEntityFieldValueFromUnknown({ name: 'gate', weight: 2, open: true })).toEqual({
      name: 'gate',
      weight: 2,
      open: true,
    });
    expect(gameEntityFieldValueFromUnknown({ nested: { deep: 1 } })).toBeUndefined();
    expect(gameEntityFieldValueFromUnknown([1, 'a'])).toBeUndefined();
    expect(gameEntityFieldValueFromUnknown(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(gameEntityFieldValueEquals([1, 2], [1, 2])).toBe(true);
  });
});
