import type { ProceduralPart } from './procedural_part.js';

/** Role of a part that is simply solid. */
export const PROCEDURAL_PART_ROLE_SOLID = 'solid';

/** Role of a part people stand and walk on, such as a mover's sloped slab. */
export const PROCEDURAL_PART_ROLE_DECK = 'deck';

/** Role of a part that walls something in at its sides, such as a mover's panel. */
export const PROCEDURAL_PART_ROLE_SIDE = 'side';

/** Role of a step drawn on top of a deck. */
export const PROCEDURAL_PART_ROLE_STEP = 'step';

/** Role of an elevator car. */
export const PROCEDURAL_PART_ROLE_CAR = 'car';

/** Role of an elevator shaft post. */
export const PROCEDURAL_PART_ROLE_SHAFT = 'shaft';

/**
 * Returns a part with a role.
 *
 * @param part Part.
 * @param role Role, such as {@link PROCEDURAL_PART_ROLE_DECK}.
 * @returns Copy of the part carrying the role.
 */
export function proceduralPartRoleSet(part: ProceduralPart, role: string): ProceduralPart {
  return { ...part, role };
}

/**
 * Returns the role of a part.
 *
 * @param part Part.
 * @returns Its role, or solid when it names none.
 */
export function proceduralPartRoleOf(part: ProceduralPart): string {
  return part.role ?? PROCEDURAL_PART_ROLE_SOLID;
}
