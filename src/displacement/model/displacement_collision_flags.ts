import { DISPLACEMENT_COLLISION_FLAG_KEYS, type DisplacementCollisionFlags } from './displacement_types.js';

/**
 * Creates collision flags with every flag off.
 *
 * @returns New default flags.
 */
export function displacementCollisionFlagsDefault(): DisplacementCollisionFlags {
  return { noPhysicsCollision: false, noHullCollision: false, noRayCollision: false, seals: false };
}

/**
 * Copies collision flags.
 *
 * @param flags Source flags.
 * @returns Independent copy.
 */
export function displacementCollisionFlagsClone(
  flags: Readonly<DisplacementCollisionFlags>,
): DisplacementCollisionFlags {
  return { ...flags };
}

/**
 * Returns collision flags with some flags replaced.
 *
 * @param flags Source flags.
 * @param changes Flags to replace; missing keys keep their value.
 * @returns New merged flags.
 */
export function displacementCollisionFlagsMerge(
  flags: Readonly<DisplacementCollisionFlags>,
  changes: Readonly<Partial<DisplacementCollisionFlags>>,
): DisplacementCollisionFlags {
  const merged = displacementCollisionFlagsClone(flags);
  DISPLACEMENT_COLLISION_FLAG_KEYS.forEach((key) => {
    const change = changes[key];
    if (typeof change === 'boolean') {
      merged[key] = change;
    }
  });
  return merged;
}

/**
 * Returns whether at least one collision flag is on.
 *
 * @param flags Flags to check.
 * @returns True when any flag is set.
 */
export function displacementCollisionFlagsAnySet(flags: Readonly<DisplacementCollisionFlags>): boolean {
  return DISPLACEMENT_COLLISION_FLAG_KEYS.some((key) => flags[key]);
}

/**
 * Reads collision flags from untrusted JSON. A missing value or missing key
 * means the flag is off.
 *
 * @param value Candidate JSON value.
 * @returns Validated flags, or null when the value or a present flag is no
 *   boolean.
 */
export function displacementCollisionFlagsRead(value: unknown): DisplacementCollisionFlags | null {
  if (value === undefined) {
    return displacementCollisionFlagsDefault();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const flags = displacementCollisionFlagsDefault();
  for (const key of DISPLACEMENT_COLLISION_FLAG_KEYS) {
    const entry = record[key];
    if (entry !== undefined && typeof entry !== 'boolean') {
      return null;
    }
    flags[key] = entry === true;
  }
  return flags;
}
