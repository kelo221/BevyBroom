import { describe, expect, it } from 'vitest';
import {
  ENTITY_ARRAY_COUNT_MAX_PER_AXIS,
  ENTITY_ARRAY_COUNT_MAX_TOTAL,
  ENTITY_ARRAY_FIELD_COUNT_X,
  ENTITY_ARRAY_FIELD_COUNT_Y,
  ENTITY_ARRAY_FIELD_COUNT_Z,
  ENTITY_ARRAY_FIELD_GAP,
  ENTITY_ARRAY_GAP_MAX,
  EntityArraySettingsRules,
} from '@/entity_array/model/entity_array_settings.js';

/**
 * Array settings are read from untrusted data into whole counts and bounded
 * gaps.
 */
describe('EntityArraySettingsRules', () => {
  it('defaults to a row of two without a gap', () => {
    const settings = EntityArraySettingsRules.createDefault();
    expect(EntityArraySettingsRules.totalOf(settings)).toBe(2);
    expect(settings.counts.x).toBe(2);
    expect([settings.gap.x, settings.gap.y, settings.gap.z]).toEqual([0, 0, 0]);
  });

  it('reads back exactly the field values it writes', () => {
    const settings = EntityArraySettingsRules.fromUnknown({
      [ENTITY_ARRAY_FIELD_COUNT_X]: 3,
      [ENTITY_ARRAY_FIELD_COUNT_Y]: 2,
      [ENTITY_ARRAY_FIELD_COUNT_Z]: 4,
      [ENTITY_ARRAY_FIELD_GAP]: [0.5, 0.25, 1],
    });
    expect(settings).not.toBeNull();
    if (settings === null) {
      return;
    }
    const again = EntityArraySettingsRules.fromUnknown(EntityArraySettingsRules.toFieldValues(settings));
    expect(again).toEqual(settings);
    expect(EntityArraySettingsRules.totalOf(settings)).toBe(3 * 2 * 4);
  });

  it('rounds counts, keeps them within one and the per-axis limit, and clamps gaps', () => {
    const settings = EntityArraySettingsRules.fromUnknown({
      [ENTITY_ARRAY_FIELD_COUNT_X]: 2.6,
      [ENTITY_ARRAY_FIELD_COUNT_Y]: -4,
      [ENTITY_ARRAY_FIELD_COUNT_Z]: 'many',
      [ENTITY_ARRAY_FIELD_GAP]: [-1, ENTITY_ARRAY_GAP_MAX * 2, 0.5],
    });
    expect(settings?.counts).toEqual({ x: 3, y: 1, z: 1 });
    expect(settings?.gap).toEqual({ x: 0, y: ENTITY_ARRAY_GAP_MAX, z: 0.5 });
    const huge = EntityArraySettingsRules.fromUnknown({
      [ENTITY_ARRAY_FIELD_COUNT_X]: ENTITY_ARRAY_COUNT_MAX_PER_AXIS * 3,
    });
    expect(huge?.counts.x).toBe(ENTITY_ARRAY_COUNT_MAX_PER_AXIS);
  });

  it('lowers the largest counts until the array fits the total limit', () => {
    const settings = EntityArraySettingsRules.fromUnknown({
      [ENTITY_ARRAY_FIELD_COUNT_X]: ENTITY_ARRAY_COUNT_MAX_PER_AXIS,
      [ENTITY_ARRAY_FIELD_COUNT_Y]: ENTITY_ARRAY_COUNT_MAX_PER_AXIS,
      [ENTITY_ARRAY_FIELD_COUNT_Z]: ENTITY_ARRAY_COUNT_MAX_PER_AXIS,
    });
    expect(settings).not.toBeNull();
    if (settings === null) {
      return;
    }
    const total = EntityArraySettingsRules.totalOf(settings);
    expect(total).toBeLessThanOrEqual(ENTITY_ARRAY_COUNT_MAX_TOTAL);
    expect(Math.max(settings.counts.x, settings.counts.y, settings.counts.z)).toBeLessThan(
      ENTITY_ARRAY_COUNT_MAX_PER_AXIS,
    );
  });

  it('refuses data that is not an object', () => {
    expect(EntityArraySettingsRules.fromUnknown(null)).toBeNull();
    expect(EntityArraySettingsRules.fromUnknown([2, 1, 1])).toBeNull();
    expect(EntityArraySettingsRules.fromUnknown('2x1')).toBeNull();
  });
});
