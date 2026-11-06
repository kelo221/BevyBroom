import {
  DISPLACEMENT_COLLISION_FLAG_KEYS,
  type DisplacementCollisionFlags,
  type DisplacementFaceSurface,
  type DisplacementPower,
} from '@/displacement/model/displacement_types.js';
import { displacementCollisionFlagsMerge } from '@/displacement/model/displacement_collision_flags.js';
import { displacementPowerChange } from '@/displacement/grid/displacement_grid_power_change.js';

/** Attribute values an Attributes Apply writes; missing fields stay unchanged. */
export interface DisplacementAttributeChanges {
  /** New subdivision power; offsets and alphas are resampled. */
  power?: DisplacementPower;
  /** New elevation in meters. */
  elevation?: number;
  /** New offset multiplier. */
  scale?: number;
  /** Collision flags to change; missing keys stay unchanged. */
  flags?: Partial<DisplacementCollisionFlags>;
}

/** Per-flag value shared by every displaced face, null where the faces differ. */
export type DisplacementCollisionFlagsShared = { [Key in keyof DisplacementCollisionFlags]: boolean | null };

/** Attribute values shared by a set of displaced faces; null marks mixed values. */
export interface DisplacementAttributesShared {
  /** Shared power, or null when mixed or no face is displaced. */
  power: DisplacementPower | null;
  /** Shared elevation, or null when mixed or no face is displaced. */
  elevation: number | null;
  /** Shared scale, or null when mixed or no face is displaced. */
  scale: number | null;
  /** Shared collision flags. */
  flags: DisplacementCollisionFlagsShared;
  /** Number of displaced faces read. */
  displacedCount: number;
}

/**
 * Applies attribute changes to a displacement.
 *
 * @param displacement Source displacement, left unchanged.
 * @param changes Attribute values to write.
 * @returns New displacement carrying the changes.
 */
export function displacementAttributesApplyTo(
  displacement: Readonly<DisplacementFaceSurface>,
  changes: Readonly<DisplacementAttributeChanges>,
): DisplacementFaceSurface {
  const next = displacementPowerChange(displacement, changes.power ?? displacement.power);
  next.elevation = changes.elevation ?? next.elevation;
  next.scale = changes.scale ?? next.scale;
  next.flags = displacementCollisionFlagsMerge(next.flags, changes.flags ?? {});
  return next;
}

/**
 * Reads the attribute values shared by displacements.
 *
 * @param displacements Displacements of the displaced faces.
 * @returns Shared values, null wherever the displacements differ.
 */
export function displacementAttributesSharedRead(
  displacements: readonly Readonly<DisplacementFaceSurface>[],
): DisplacementAttributesShared {
  const flags = {} as DisplacementCollisionFlagsShared;
  DISPLACEMENT_COLLISION_FLAG_KEYS.forEach((key) => {
    flags[key] = displacementSharedValueRead(displacements.map((displacement) => displacement.flags[key]));
  });
  return {
    power: displacementSharedValueRead(displacements.map((displacement) => displacement.power)),
    elevation: displacementSharedValueRead(displacements.map((displacement) => displacement.elevation)),
    scale: displacementSharedValueRead(displacements.map((displacement) => displacement.scale)),
    flags,
    displacedCount: displacements.length,
  };
}

/**
 * Returns the value every entry of a list holds.
 *
 * @param values Values to compare.
 * @returns The common value, or null when the list is empty or mixed.
 */
function displacementSharedValueRead<Value>(values: readonly Value[]): Value | null {
  const first = values[0];
  if (first === undefined || values.some((value) => value !== first)) {
    return null;
  }
  return first;
}
