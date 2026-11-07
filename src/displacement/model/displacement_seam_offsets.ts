import type * as THREE from 'three';
import type { DisplacementFaceSurface } from './displacement_types.js';

/** Number of stored components of one seam offset. */
export const DISPLACEMENT_SEAM_OFFSET_COMPONENTS = 3;

/** Largest seam offset component that still counts as zero. */
const DISPLACEMENT_SEAM_OFFSET_EPSILON = 1e-9;

/**
 * Returns whether any seam offset component is measurably non-zero.
 *
 * @param seamOffsets Flat seam offset list.
 * @returns True when at least one component exceeds the zero tolerance.
 */
export function displacementSeamOffsetsAnyNonZero(seamOffsets: readonly number[]): boolean {
  return seamOffsets.some((component) => Math.abs(component) > DISPLACEMENT_SEAM_OFFSET_EPSILON);
}

/**
 * Reads the face-frame seam offset of one vertex.
 *
 * @param displacement Displacement data.
 * @param vertexIndex Row-major vertex index.
 * @param target Vector receiving the seam offset, zero when the surface has
 *   none.
 * @returns The target vector.
 */
export function displacementSeamOffsetRead(
  displacement: Readonly<DisplacementFaceSurface>,
  vertexIndex: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  const seamOffsets = displacement.seamOffsets;
  if (!seamOffsets) {
    return target.set(0, 0, 0);
  }
  const start = vertexIndex * DISPLACEMENT_SEAM_OFFSET_COMPONENTS;
  return target.set(seamOffsets[start] ?? 0, seamOffsets[start + 1] ?? 0, seamOffsets[start + 2] ?? 0);
}

/**
 * Stores the face-frame seam offset of one vertex. A surface without seam
 * offsets only receives the list when the stored offset is non-zero.
 *
 * @param displacement Displacement data to change.
 * @param vertexIndex Row-major vertex index.
 * @param seamOffset Face-frame seam offset to store.
 * @returns True when the stored seam offset changed.
 */
export function displacementSeamOffsetWrite(
  displacement: DisplacementFaceSurface,
  vertexIndex: number,
  seamOffset: Readonly<THREE.Vector3>,
): boolean {
  const components = [seamOffset.x, seamOffset.y, seamOffset.z];
  if (!displacement.seamOffsets && !displacementSeamOffsetsAnyNonZero(components)) {
    return false;
  }
  const seamOffsets = displacementSeamOffsetsEnsure(displacement);
  const start = vertexIndex * DISPLACEMENT_SEAM_OFFSET_COMPONENTS;
  const changed = components.some(
    (component, axis) => Math.abs(component - (seamOffsets[start + axis] ?? 0)) > DISPLACEMENT_SEAM_OFFSET_EPSILON,
  );
  seamOffsets.splice(start, DISPLACEMENT_SEAM_OFFSET_COMPONENTS, ...components);
  return changed;
}

/**
 * Returns the seam offset list of a displacement, creating an all-zero list
 * when the surface has none.
 *
 * @param displacement Displacement data to change.
 * @returns The stored seam offset list.
 */
function displacementSeamOffsetsEnsure(displacement: DisplacementFaceSurface): number[] {
  if (!displacement.seamOffsets) {
    displacement.seamOffsets = new Array<number>(
      displacement.offsets.length * DISPLACEMENT_SEAM_OFFSET_COMPONENTS,
    ).fill(0);
  }
  return displacement.seamOffsets;
}

/**
 * Reads a seam offset list from untrusted JSON.
 *
 * @param value Candidate list.
 * @param vertexCount Number of grid vertices the list must cover.
 * @returns Validated copy, or undefined when the list is missing, has the wrong
 *   shape, holds non-finite entries or is all zero.
 */
export function displacementSeamOffsetsReadJson(value: unknown, vertexCount: number): number[] | undefined {
  if (!Array.isArray(value) || value.length !== vertexCount * DISPLACEMENT_SEAM_OFFSET_COMPONENTS) {
    return undefined;
  }
  const components = value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
  if (components.length !== value.length || !displacementSeamOffsetsAnyNonZero(components)) {
    return undefined;
  }
  return components;
}

/**
 * Splits a flat seam offset list into one row-major value list per component.
 *
 * @param seamOffsets Flat seam offset list.
 * @returns Three per-vertex value lists.
 */
export function displacementSeamOffsetsComponentsSplit(seamOffsets: readonly number[]): number[][] {
  const vertexCount = seamOffsets.length / DISPLACEMENT_SEAM_OFFSET_COMPONENTS;
  return Array.from({ length: DISPLACEMENT_SEAM_OFFSET_COMPONENTS }, (_unused, axis) =>
    Array.from(
      { length: vertexCount },
      (_vertex, vertexIndex) => seamOffsets[vertexIndex * DISPLACEMENT_SEAM_OFFSET_COMPONENTS + axis] ?? 0,
    ),
  );
}

/**
 * Joins one row-major value list per component into a flat seam offset list.
 *
 * @param components Three per-vertex value lists of equal length.
 * @returns Flat seam offset list.
 */
export function displacementSeamOffsetsComponentsJoin(components: readonly (readonly number[])[]): number[] {
  const vertexCount = components[0]?.length ?? 0;
  const seamOffsets: number[] = [];
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
    for (let axis = 0; axis < DISPLACEMENT_SEAM_OFFSET_COMPONENTS; axis++) {
      seamOffsets.push(components[axis]?.[vertexIndex] ?? 0);
    }
  }
  return seamOffsets;
}
