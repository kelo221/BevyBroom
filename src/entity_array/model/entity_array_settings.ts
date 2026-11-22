import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { proceduralFieldValueSanitize } from '@/procedural/generator/procedural_field_value_sanitize.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Field path of the number of copies along the owner's X axis. */
export const ENTITY_ARRAY_FIELD_COUNT_X = 'count_x';

/** Field path of the number of copies along the owner's Y axis. */
export const ENTITY_ARRAY_FIELD_COUNT_Y = 'count_y';

/** Field path of the number of copies along the owner's Z axis. */
export const ENTITY_ARRAY_FIELD_COUNT_Z = 'count_z';

/** Field path of the space left between neighbouring copies on each axis. */
export const ENTITY_ARRAY_FIELD_GAP = 'gap';

/** Most copies along one axis. */
export const ENTITY_ARRAY_COUNT_MAX_PER_AXIS = 64;

/** Most objects one array holds, the source included. */
export const ENTITY_ARRAY_COUNT_MAX_TOTAL = 1024;

/** Largest gap between neighbours, in meters. */
export const ENTITY_ARRAY_GAP_MAX = 100;

/** Axes an array repeats along, in field order. */
export const ENTITY_ARRAY_AXES = ['x', 'y', 'z'] as const;

/** One axis an array repeats along. */
export type EntityArrayAxis = (typeof ENTITY_ARRAY_AXES)[number];

/**
 * How an entity repeats: the number of objects along each of its own axes,
 * itself included, and the space left between neighbours on each axis.
 */
export interface EntityArraySettings {
  readonly counts: Readonly<Record<EntityArrayAxis, number>>;
  readonly gap: Readonly<Record<EntityArrayAxis, number>>;
}

/**
 * Returns the field of the count along one axis.
 *
 * @param path Field path.
 * @param label Caption shown in the inspector.
 * @returns Integer field from one to the per-axis limit.
 */
function entityArrayCountFieldCreate(path: string, label: string): GameEntityField {
  return { path, label, kind: 'integer', default: 1, minimum: 1, maximum: ENTITY_ARRAY_COUNT_MAX_PER_AXIS, step: 1 };
}

/** Fields an array is edited through, in display order. */
export const ENTITY_ARRAY_FIELDS: readonly GameEntityField[] = [
  entityArrayCountFieldCreate(ENTITY_ARRAY_FIELD_COUNT_X, 'Count X'),
  entityArrayCountFieldCreate(ENTITY_ARRAY_FIELD_COUNT_Y, 'Count Y'),
  entityArrayCountFieldCreate(ENTITY_ARRAY_FIELD_COUNT_Z, 'Count Z'),
  { path: ENTITY_ARRAY_FIELD_GAP, label: 'Gap', kind: 'vector3', default: [0, 0, 0], step: 0.03125 },
];

/** Count field path of every axis. */
const ENTITY_ARRAY_COUNT_PATHS: Readonly<Record<EntityArrayAxis, string>> = {
  x: ENTITY_ARRAY_FIELD_COUNT_X,
  y: ENTITY_ARRAY_FIELD_COUNT_Y,
  z: ENTITY_ARRAY_FIELD_COUNT_Z,
};

/** Reads, validates and converts array settings. */
export class EntityArraySettingsRules {
  /**
   * Returns the settings of a new array: two objects along X without a gap.
   *
   * @returns Fresh settings.
   */
  static createDefault(): EntityArraySettings {
    return { counts: { x: 2, y: 1, z: 1 }, gap: { x: 0, y: 0, z: 0 } };
  }

  /**
   * Reads untrusted data into valid settings: whole counts within the limits,
   * gaps from zero to the largest gap, and no more objects than one array may
   * hold.
   *
   * @param value Any value, such as a scene file entry.
   * @returns Valid settings, or null when the value is not an object.
   */
  static fromUnknown(value: unknown): EntityArraySettings | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const fieldValues = EntityArraySettingsRules.fieldValuesOf(value as Record<string, unknown>);
    return EntityArraySettingsRules.totalLimit(EntityArraySettingsRules.fromFieldValues(fieldValues));
  }

  /**
   * Returns the settings as field values keyed by field path, the form scene
   * files and the inspector use.
   *
   * @param settings Valid settings.
   * @returns Field values.
   */
  static toFieldValues(settings: EntityArraySettings): Record<string, PreviewFieldValue> {
    return {
      [ENTITY_ARRAY_FIELD_COUNT_X]: settings.counts.x,
      [ENTITY_ARRAY_FIELD_COUNT_Y]: settings.counts.y,
      [ENTITY_ARRAY_FIELD_COUNT_Z]: settings.counts.z,
      [ENTITY_ARRAY_FIELD_GAP]: [settings.gap.x, settings.gap.y, settings.gap.z],
    };
  }

  /**
   * Returns the number of objects the array holds, the source included.
   *
   * @param settings Valid settings.
   * @returns Product of the counts.
   */
  static totalOf(settings: EntityArraySettings): number {
    return settings.counts.x * settings.counts.y * settings.counts.z;
  }

  /**
   * Returns a valid value for every field from untrusted field values.
   *
   * @param candidate Untrusted field values by path.
   * @returns Sanitized field values by path.
   */
  private static fieldValuesOf(candidate: Readonly<Record<string, unknown>>): Record<string, PreviewFieldValue> {
    const values: Record<string, PreviewFieldValue> = {};
    for (const field of ENTITY_ARRAY_FIELDS) {
      values[field.path] = proceduralFieldValueSanitize(field, candidate[field.path]);
    }
    return values;
  }

  /**
   * Builds settings from sanitized field values.
   *
   * @param values Sanitized field values by path.
   * @returns Settings with gaps clamped to their range.
   */
  private static fromFieldValues(values: Readonly<Record<string, PreviewFieldValue>>): EntityArraySettings {
    const gapValue = values[ENTITY_ARRAY_FIELD_GAP];
    const gapList = Array.isArray(gapValue) ? gapValue : [0, 0, 0];
    const counts = { x: 1, y: 1, z: 1 };
    const gap = { x: 0, y: 0, z: 0 };
    ENTITY_ARRAY_AXES.forEach((axis, index) => {
      const count = values[ENTITY_ARRAY_COUNT_PATHS[axis]];
      counts[axis] = typeof count === 'number' ? count : 1;
      gap[axis] = EntityArraySettingsRules.gapClamp(gapList[index]);
    });
    return { counts, gap };
  }

  /**
   * Clamps one gap to its range.
   *
   * @param value Candidate gap.
   * @returns Gap from zero to the largest gap; zero for anything that is not a
   *   finite number.
   */
  private static gapClamp(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }
    return Math.min(ENTITY_ARRAY_GAP_MAX, Math.max(0, value));
  }

  /**
   * Lowers the counts, largest first, until the array holds no more objects
   * than one array may.
   *
   * @param settings Settings with valid per-axis counts.
   * @returns Settings within the total limit.
   */
  private static totalLimit(settings: EntityArraySettings): EntityArraySettings {
    const counts = { ...settings.counts };
    while (counts.x * counts.y * counts.z > ENTITY_ARRAY_COUNT_MAX_TOTAL) {
      const largest = ENTITY_ARRAY_AXES.reduce((best, axis) => (counts[axis] > counts[best] ? axis : best));
      counts[largest] -= 1;
    }
    return { counts, gap: settings.gap };
  }
}
