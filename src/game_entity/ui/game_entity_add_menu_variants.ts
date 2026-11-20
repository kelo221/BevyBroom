import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** One kind a class offers through the values of its marker box field. */
export interface GameEntityAddMenuVariant {
  /** Marker box field value as text, such as a catalogue id. */
  readonly valueText: string;
  /** Components a new entity of this kind carries. */
  readonly components: GameEntityComponents;
  /** Class the kind is a value of. */
  readonly gameClass: GameEntityClass;
  /** Display name, such as "Big fridge". */
  readonly label: string;
  /** Group the kind is listed in, such as "Fridges & freezers". */
  readonly group: string;
}

/**
 * Lists the kinds of a class whose marker box is picked by a field value: one
 * per value that has a marker box, in value order.
 *
 * @param gameClass Component class.
 * @returns Kinds, or none when the class picks no box by a field it lists.
 */
export function gameEntityAddMenuVariantsOf(gameClass: GameEntityClass): GameEntityAddMenuVariant[] {
  const fieldPath = gameClass.marker_box_field;
  const field = fieldPath === undefined ? null : GameEntityComponentResolver.fieldFind(gameClass, fieldPath);
  if (field === null) {
    return [];
  }
  return Object.keys(gameClass.marker_boxes ?? {})
    .sort()
    .map((valueText) => ({
      valueText,
      components: gameEntityAddMenuVariantComponents(gameClass, field, valueText),
      gameClass,
      label: field.variant_details?.[valueText]?.label ?? gameEntityAddMenuVariantLabelFromValue(valueText),
      group: field.variant_details?.[valueText]?.group ?? gameClass.label,
    }));
}

/**
 * Returns a readable name for a field value without a display name, such as
 * "Shelf tall 4" for `shelf-tall-4`.
 *
 * @param valueText Field value as text.
 * @returns Readable name.
 */
export function gameEntityAddMenuVariantLabelFromValue(valueText: string): string {
  const words = valueText
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Returns the components of a new entity whose marker box field holds a value,
 * leaving the field out when the value is its default.
 *
 * @param gameClass Component class.
 * @param field Marker box field.
 * @param valueText Field value as text.
 * @returns Components carrying the class.
 */
function gameEntityAddMenuVariantComponents(
  gameClass: GameEntityClass,
  field: GameEntityField,
  valueText: string,
): GameEntityComponents {
  const value = gameEntityAddMenuVariantValueOf(field, valueText);
  const isDefault = value === field.default;
  return { [gameClass.type_path]: isDefault ? {} : { [field.path]: value } };
}

/**
 * Turns a field value written as text into the value the field holds.
 *
 * @param field Marker box field.
 * @param valueText Field value as text.
 * @returns Number for number fields, boolean for boolean fields, otherwise the
 *   text.
 */
function gameEntityAddMenuVariantValueOf(field: GameEntityField, valueText: string): PreviewFieldValue {
  if (field.kind === 'number' || field.kind === 'integer') {
    const number = Number(valueText);
    return Number.isFinite(number) ? number : valueText;
  }
  if (field.kind === 'bool') {
    return valueText === 'true';
  }
  return valueText;
}
