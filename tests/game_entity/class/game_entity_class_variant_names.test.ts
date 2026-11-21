import { describe, expect, it } from 'vitest';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassVariantNames } from '@/game_entity/class/game_entity_class_variant_names.js';

/**
 * Returns an enum field whose first variant has a name and a group in the class
 * file and whose second variant has neither.
 *
 * @returns Enum field.
 */
function fixtureFieldCreate(): GameEntityField {
  return {
    path: 'fixture',
    label: 'Fixture',
    kind: 'enum',
    default: 'big-fridge',
    variants: ['big-fridge', 'shelf-tall-4'],
    variant_details: { 'big-fridge': { label: 'Big fridge', group: 'Fridges & freezers' } },
  };
}

describe('GameEntityClassVariantNames', () => {
  it('uses the label and group the class file gives a variant', () => {
    const field = fixtureFieldCreate();
    expect(GameEntityClassVariantNames.labelOf(field, 'big-fridge')).toBe('Big fridge');
    expect(GameEntityClassVariantNames.groupOf(field, 'big-fridge')).toBe('Fridges & freezers');
  });

  it('makes a readable name from a variant without details and gives it no group', () => {
    const field = fixtureFieldCreate();
    expect(GameEntityClassVariantNames.labelOf(field, 'shelf-tall-4')).toBe('Shelf tall 4');
    expect(GameEntityClassVariantNames.groupOf(field, 'shelf-tall-4')).toBeNull();
  });

  it('turns field values into readable names', () => {
    expect(GameEntityClassVariantNames.labelFromValue('shelf-tall-4')).toBe('Shelf tall 4');
    expect(GameEntityClassVariantNames.labelFromValue('BigFridge')).toBe('Big fridge');
  });
});
