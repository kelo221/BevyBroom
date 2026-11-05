import {
  DISPLACEMENT_ALPHA_MAX,
  DISPLACEMENT_POWERS,
  type DisplacementFaceSurface,
  type DisplacementPower,
} from './displacement_types.js';

/**
 * Returns how many vertices one side of a displacement grid has.
 *
 * @param power Subdivision power.
 * @returns 2^power + 1.
 */
export function displacementRowLength(power: DisplacementPower): number {
  return (1 << power) + 1;
}

/**
 * Returns how many vertices a displacement grid has in total.
 *
 * @param power Subdivision power.
 * @returns (2^power + 1)^2.
 */
export function displacementVertexCount(power: DisplacementPower): number {
  const rowLength = displacementRowLength(power);
  return rowLength * rowLength;
}

/**
 * Returns whether a value is a supported displacement power.
 *
 * @param value Candidate value.
 * @returns True for 2, 3 or 4.
 */
export function displacementPowerIs(value: unknown): value is DisplacementPower {
  return DISPLACEMENT_POWERS.some((power) => power === value);
}

/**
 * Creates a flat displacement with zero offsets and zero alphas.
 *
 * @param power Subdivision power.
 * @param elevation Distance the surface sits above the face.
 * @returns New displacement surface.
 */
export function displacementSurfaceCreate(power: DisplacementPower, elevation: number = 0): DisplacementFaceSurface {
  const vertexCount = displacementVertexCount(power);
  return {
    power,
    elevation,
    scale: 1,
    offsets: new Array<number>(vertexCount).fill(0),
    alphas: new Array<number>(vertexCount).fill(0),
  };
}

/**
 * Returns the offset change that moves a vertex by a distance along the face
 * normal, treating a zero scale as one.
 *
 * @param surface Displacement whose scale applies.
 * @param distance Distance in meters.
 * @returns Offset delta before scale.
 */
export function displacementOffsetDeltaForDistance(
  surface: Readonly<DisplacementFaceSurface>,
  distance: number,
): number {
  const scale = Math.abs(surface.scale) < 1e-6 ? 1 : surface.scale;
  return distance / scale;
}

/**
 * Deep-copies a displacement surface.
 *
 * @param surface Source surface.
 * @returns Independent copy.
 */
export function displacementSurfaceClone(surface: DisplacementFaceSurface): DisplacementFaceSurface {
  return {
    power: surface.power,
    elevation: surface.elevation,
    scale: surface.scale,
    offsets: surface.offsets.slice(),
    alphas: surface.alphas.slice(),
  };
}

/**
 * Reads a displacement surface from untrusted JSON, filling missing alphas with
 * zero and rejecting wrong vertex counts.
 *
 * @param value Candidate JSON value.
 * @returns Validated copy, or null when the value is no displacement.
 */
export function displacementSurfaceRead(value: unknown): DisplacementFaceSurface | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const power = record['power'];
  if (!displacementPowerIs(power)) {
    return null;
  }
  return displacementSurfaceReadWithPower(record, power);
}

/**
 * Reads the vertex lists and scalars of a displacement record whose power is
 * already validated.
 *
 * @param record JSON record.
 * @param power Validated subdivision power.
 * @returns Validated copy, or null when a vertex list has the wrong shape.
 */
function displacementSurfaceReadWithPower(
  record: Record<string, unknown>,
  power: DisplacementPower,
): DisplacementFaceSurface | null {
  const vertexCount = displacementVertexCount(power);
  const offsets = displacementNumberListRead(record['offsets'], vertexCount, 0);
  const alphas = displacementNumberListRead(record['alphas'], vertexCount, 0);
  if (!offsets || !alphas) {
    return null;
  }
  return {
    power,
    elevation: displacementFiniteNumberRead(record['elevation'], 0),
    scale: displacementFiniteNumberRead(record['scale'], 1),
    offsets,
    alphas: alphas.map((alpha) => Math.min(DISPLACEMENT_ALPHA_MAX, Math.max(0, alpha))),
  };
}

/**
 * Reads a finite number, or a fallback for anything else.
 *
 * @param value Candidate value.
 * @param fallback Value used when the candidate is no finite number.
 * @returns Number.
 */
function displacementFiniteNumberRead(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Reads a list of finite numbers of an exact length. A missing list becomes a
 * list filled with the fallback.
 *
 * @param value Candidate list.
 * @param length Required length.
 * @param fallback Fill value for a missing list.
 * @returns Number list, or null when the list has the wrong shape.
 */
function displacementNumberListRead(value: unknown, length: number, fallback: number): number[] | null {
  if (value === undefined) {
    return new Array<number>(length).fill(fallback);
  }
  if (!Array.isArray(value) || value.length !== length) {
    return null;
  }
  const numbers = value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
  return numbers.length === length ? numbers : null;
}
