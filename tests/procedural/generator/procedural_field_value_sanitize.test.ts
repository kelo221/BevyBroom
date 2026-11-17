import { describe, expect, it } from 'vitest';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { proceduralFieldValueSanitize } from '@/procedural/generator/procedural_field_value_sanitize.js';

const numberField: GameEntityField = {
  path: 'width',
  label: 'Width',
  kind: 'number',
  default: 1,
  minimum: 0.5,
  maximum: 4,
};
const vectorField: GameEntityField = { path: 'end', label: 'End', kind: 'vector3', default: [0, 1, 2] };
const enumField: GameEntityField = {
  path: 'direction',
  label: 'Direction',
  kind: 'enum',
  default: 'up',
  variants: ['up', 'down'],
};

/** Field values of procedural parameters are always valid for their field. */
describe('proceduralFieldValueSanitize', () => {
  it('keeps numbers in range and clamps the rest into it', () => {
    const minimum = numberField.minimum ?? 0;
    const maximum = numberField.maximum ?? 0;
    expect(proceduralFieldValueSanitize(numberField, (minimum + maximum) / 2)).toBe((minimum + maximum) / 2);
    expect(proceduralFieldValueSanitize(numberField, maximum * 10)).toBe(maximum);
    expect(proceduralFieldValueSanitize(numberField, minimum - 10)).toBe(minimum);
  });

  it('falls back to the default for values of the wrong kind', () => {
    expect(proceduralFieldValueSanitize(numberField, 'wide')).toBe(numberField.default);
    expect(proceduralFieldValueSanitize(numberField, Number.NaN)).toBe(numberField.default);
    expect(proceduralFieldValueSanitize(vectorField, [1, 2])).toEqual(vectorField.default);
    expect(proceduralFieldValueSanitize(vectorField, [1, Infinity, 2])).toEqual(vectorField.default);
    expect(proceduralFieldValueSanitize(enumField, 'sideways')).toBe(enumField.default);
  });

  it('keeps valid vectors as copies and valid variants', () => {
    const candidate = [3, -4, 5.5];
    const sanitized = proceduralFieldValueSanitize(vectorField, candidate);
    expect(sanitized).toEqual(candidate);
    expect(sanitized).not.toBe(candidate);
    expect(proceduralFieldValueSanitize(enumField, 'down')).toBe('down');
  });

  it('rounds integers', () => {
    const integerField: GameEntityField = { ...numberField, kind: 'integer', minimum: 0, maximum: 10 };
    expect(proceduralFieldValueSanitize(integerField, 2.6)).toBe(3);
  });
});
