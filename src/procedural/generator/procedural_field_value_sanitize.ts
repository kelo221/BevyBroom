import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Turns a candidate value into a valid value of one field kind. */
type ProceduralFieldValueSanitizer = (field: GameEntityField, candidate: unknown) => PreviewFieldValue;

/** Number of components of every vector field kind. */
const PROCEDURAL_FIELD_VECTOR_LENGTHS: Readonly<Record<string, number>> = { vector2: 2, vector3: 3, vector4: 4 };

/** Sanitizer of every field kind procedural generators may declare. */
const PROCEDURAL_FIELD_VALUE_SANITIZERS: Readonly<Record<string, ProceduralFieldValueSanitizer>> = {
  number: proceduralFieldNumberSanitize,
  integer: (field, candidate) => Math.round(proceduralFieldNumberSanitize(field, candidate)),
  bool: (field, candidate) => (typeof candidate === 'boolean' ? candidate : field.default),
  text: (field, candidate) => (typeof candidate === 'string' ? candidate : field.default),
  enum: proceduralFieldEnumSanitize,
  vector2: proceduralFieldVectorSanitize,
  vector3: proceduralFieldVectorSanitize,
  vector4: proceduralFieldVectorSanitize,
};

/**
 * Returns a valid value of a field: the candidate when it fits the field's kind
 * and range, clamped into the range when it is a number outside it, else the
 * field's default.
 *
 * @param field Field description with kind, default and optional range.
 * @param candidate Untrusted value.
 * @returns Valid field value.
 */
export function proceduralFieldValueSanitize(field: GameEntityField, candidate: unknown): PreviewFieldValue {
  const sanitizer = PROCEDURAL_FIELD_VALUE_SANITIZERS[field.kind];
  return sanitizer ? sanitizer(field, candidate) : field.default;
}

/**
 * Returns a finite number clamped into the field's range, or the default.
 *
 * @param field Number field.
 * @param candidate Untrusted value.
 * @returns Valid number.
 */
function proceduralFieldNumberSanitize(field: GameEntityField, candidate: unknown): number {
  const fallback = typeof field.default === 'number' ? field.default : 0;
  const value = typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
  return Math.min(field.maximum ?? Infinity, Math.max(field.minimum ?? -Infinity, value));
}

/**
 * Returns the candidate when it is one of the field's variants, else the
 * default.
 *
 * @param field Enum field with variants.
 * @param candidate Untrusted value.
 * @returns Valid variant.
 */
function proceduralFieldEnumSanitize(field: GameEntityField, candidate: unknown): PreviewFieldValue {
  const variants = field.variants ?? [];
  return typeof candidate === 'string' && variants.includes(candidate) ? candidate : field.default;
}

/**
 * Returns the candidate when it is a list of finite numbers of the field's
 * length, else the default.
 *
 * @param field Vector field.
 * @param candidate Untrusted value.
 * @returns Valid vector.
 */
function proceduralFieldVectorSanitize(field: GameEntityField, candidate: unknown): PreviewFieldValue {
  const length = PROCEDURAL_FIELD_VECTOR_LENGTHS[field.kind] ?? 0;
  const isValid =
    Array.isArray(candidate) &&
    candidate.length === length &&
    candidate.every((component) => typeof component === 'number' && Number.isFinite(component));
  return isValid ? [...(candidate as number[])] : field.default;
}
