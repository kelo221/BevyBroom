import type {
  PreviewFieldValue,
  PreviewPlaceableField,
  PreviewPlaceableFieldKind,
} from '@/preview/protocol/preview_protocol_placeable_types.js';

/** A property map value: named text, number and boolean values. */
type GameEntityPropertyMap = { [key: string]: string | number | boolean };

/** Number of components of each vector kind. */
const GAME_ENTITY_VECTOR_SIZES: Partial<Record<PreviewPlaceableFieldKind, number>> = {
  vector2: 2,
  vector3: 3,
  vector4: 4,
  color: 4,
};

/**
 * Reads an untrusted stored value into a wire field value.
 *
 * @param value Any value.
 * @returns The value, or undefined when it cannot travel as a field value.
 */
export function gameEntityFieldValueFromUnknown(value: unknown): PreviewFieldValue | undefined {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    return gameEntityNumberListIs(value) ? [...value] : undefined;
  }
  return gameEntityPropertyMapFromUnknown(value) ?? undefined;
}

/** Coerces a candidate value into one that fits a field of one kind. */
type GameEntityFieldNormalizer = (field: PreviewPlaceableField, value: unknown) => PreviewFieldValue | undefined;

/** Value normalizer of every editable field kind. */
const GAME_ENTITY_FIELD_NORMALIZERS: Partial<Record<PreviewPlaceableFieldKind, GameEntityFieldNormalizer>> = {
  number: (field, value) => (gameEntityFiniteIs(value) ? gameEntityNumberClamp(field, value) : undefined),
  integer: (field, value) => (gameEntityFiniteIs(value) ? gameEntityNumberClamp(field, Math.round(value)) : undefined),
  bool: (_field, value) => (typeof value === 'boolean' ? value : undefined),
  text: (_field, value) => (typeof value === 'string' ? value : undefined),
  enum: (field, value) =>
    typeof value === 'string' && (field.variants ?? [value]).includes(value) ? value : undefined,
  asset: (_field, value) => (value === null || typeof value === 'string' ? value : undefined),
  property_map: (_field, value) => gameEntityPropertyMapFromUnknown(value) ?? undefined,
  vector2: (field, value) => gameEntityVectorNormalize(field.kind, value),
  vector3: (field, value) => gameEntityVectorNormalize(field.kind, value),
  vector4: (field, value) => gameEntityVectorNormalize(field.kind, value),
  color: (field, value) => gameEntityVectorNormalize(field.kind, value),
};

/**
 * Returns a value that fits a field, coercing numbers into its range.
 *
 * @param field Field description.
 * @param value Candidate value.
 * @returns Fitting value, or undefined when the value does not fit the field or
 *   the field cannot be edited.
 */
export function gameEntityFieldValueNormalize(
  field: PreviewPlaceableField,
  value: unknown,
): PreviewFieldValue | undefined {
  const normalizer = GAME_ENTITY_FIELD_NORMALIZERS[field.kind];
  return normalizer ? normalizer(field, value) : undefined;
}

/**
 * Returns whether a value is a finite number.
 *
 * @param value Any value.
 * @returns True for finite numbers.
 */
function gameEntityFiniteIs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns whether two field values are equal.
 *
 * @param first First value.
 * @param second Second value.
 * @returns True when both serialize the same.
 */
export function gameEntityFieldValueEquals(
  first: PreviewFieldValue | undefined,
  second: PreviewFieldValue | undefined,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * Normalizes a vector or color value.
 *
 * @param kind Field kind.
 * @param value Candidate value.
 * @returns Number list of the kind's size, or undefined for other kinds and
 *   values.
 */
function gameEntityVectorNormalize(kind: PreviewPlaceableFieldKind, value: unknown): PreviewFieldValue | undefined {
  const size = GAME_ENTITY_VECTOR_SIZES[kind];
  if (size === undefined || !Array.isArray(value) || value.length !== size || !gameEntityNumberListIs(value)) {
    return undefined;
  }
  return kind === 'color' ? value.map((channel) => Math.min(1, Math.max(0, channel))) : [...value];
}

/**
 * Clamps a number into a field's range.
 *
 * @param field Field description with optional bounds.
 * @param value Finite number.
 * @returns Number inside the bounds.
 */
function gameEntityNumberClamp(field: PreviewPlaceableField, value: number): number {
  const minimum = field.minimum ?? Number.NEGATIVE_INFINITY;
  const maximum = field.maximum ?? Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Returns whether every entry of a list is a finite number.
 *
 * @param values Candidate list.
 * @returns True for lists of finite numbers.
 */
function gameEntityNumberListIs(values: readonly unknown[]): values is number[] {
  return values.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

/**
 * Reads a property map, accepting only text, finite numbers and booleans.
 *
 * @param value Any value.
 * @returns Copied map, or null when the value is not a map of scalars.
 */
function gameEntityPropertyMapFromUnknown(value: unknown): GameEntityPropertyMap | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const map: GameEntityPropertyMap = {};
  for (const [name, entry] of Object.entries(value)) {
    const scalarIs = typeof entry === 'string' || typeof entry === 'boolean';
    if (!scalarIs && !(typeof entry === 'number' && Number.isFinite(entry))) {
      return null;
    }
    map[name] = entry as string | number | boolean;
  }
  return map;
}
