import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { GizmoAxis } from '@/types/transform_mode.js';
import { getBoundsFaceHalfExtent } from '@/transform/bounds/builder_oriented_bounds.js';

/** UserData key storing the list of bounds faces a resize handle drags. */
export const BOUNDS_HANDLE_FACES_KEY = 'boundsHandleFaces';

/** Empty face list returned for objects that are not resize handles. */
const BOUNDS_HANDLE_NO_FACES: readonly BoundsFace[] = Object.freeze([]);

/** Every bounds face name, for validating stored face lists. */
const BOUNDS_FACE_NAMES: readonly unknown[] = Object.values(BoundsFace);

/** Validated face lists keyed by the userData array they were read from. */
const validatedFaceListCache = new WeakMap<unknown[], readonly BoundsFace[]>();

/** Scratch normal reused while summing face normals. */
const scratchFaceNormal = new THREE.Vector3();

/** Axis letter of a bounds face. */
export type BoundsFaceAxisLetter = 'x' | 'y' | 'z';

/**
 * Returns the axis letter of a bounds face.
 *
 * @param face Bounds face.
 * @returns Axis letter of the face normal.
 */
export function boundsFaceAxisLetter(face: BoundsFace): BoundsFaceAxisLetter {
  if (face === BoundsFace.POS_X || face === BoundsFace.NEG_X) {
    return 'x';
  }
  if (face === BoundsFace.POS_Y || face === BoundsFace.NEG_Y) {
    return 'y';
  }
  return 'z';
}

/**
 * Returns the twelve corner face pairs of a box: every pair of faces on two
 * different axes. Each pair is one box edge and shows as a rectangle corner in
 * the view plane that contains both axes.
 *
 * @returns Face pairs, each ordered by the face list order.
 */
export function boundsHandleCornerFacePairsAll(): BoundsFace[][] {
  const faces = Object.values(BoundsFace);
  const pairs: BoundsFace[][] = [];
  faces.forEach((firstFace, firstIndex) => {
    faces.slice(firstIndex + 1).forEach((secondFace) => {
      if (boundsFaceAxisLetter(firstFace) !== boundsFaceAxisLetter(secondFace)) {
        pairs.push([firstFace, secondFace]);
      }
    });
  });
  return pairs;
}

/**
 * Returns whether a handle face list describes a corner (two faces).
 *
 * @param faces Faces dragged by the handle.
 * @returns True for corner handles.
 */
export function boundsHandleFacesIsCorner(faces: readonly BoundsFace[]): boolean {
  return faces.length > 1;
}

/**
 * Returns whether two handle face lists name the same faces.
 *
 * @param firstFaces First face list.
 * @param secondFaces Second face list.
 * @returns True when both lists hold the same faces in any order.
 */
export function boundsHandleFacesEqual(firstFaces: readonly BoundsFace[], secondFaces: readonly BoundsFace[]): boolean {
  if (firstFaces.length !== secondFaces.length) {
    return false;
  }
  return firstFaces.every((face) => secondFaces.includes(face));
}

/**
 * Returns whether any face of a handle lies on one of the given axes.
 *
 * @param faces Faces dragged by the handle.
 * @param axes Axis letters to test against.
 * @returns True when a face normal runs along one of the axes.
 */
export function boundsHandleFacesTouchAxes(
  faces: readonly BoundsFace[],
  axes: ReadonlyArray<BoundsFaceAxisLetter>,
): boolean {
  return faces.some((face) => axes.includes(boundsFaceAxisLetter(face)));
}

/**
 * Maps a handle face list to the gizmo axis stored on its handle.
 *
 * @param faces Faces dragged by the handle.
 * @returns Single axis for one face, plane axis for a corner.
 */
export function boundsHandleFacesGizmoAxis(faces: readonly BoundsFace[]): GizmoAxis {
  const letters = faces.map((face) => boundsFaceAxisLetter(face)).sort();
  const key = letters.join('');
  if (key === 'xy') {
    return GizmoAxis.XY_PLANE;
  }
  if (key === 'yz') {
    return GizmoAxis.YZ_PLANE;
  }
  if (key === 'xz') {
    return GizmoAxis.XZ_PLANE;
  }
  return boundsHandleSingleGizmoAxis(key);
}

/**
 * Maps one axis letter to its single gizmo axis.
 *
 * @param letter Axis letter.
 * @returns Matching gizmo axis.
 */
function boundsHandleSingleGizmoAxis(letter: string): GizmoAxis {
  if (letter === 'x') {
    return GizmoAxis.X;
  }
  if (letter === 'y') {
    return GizmoAxis.Y;
  }
  return GizmoAxis.Z;
}

/**
 * Writes the local outward normal of a bounds face without allocating.
 *
 * @param face Bounds face.
 * @param out Vector receiving the unit normal.
 * @returns The out vector.
 */
export function boundsFaceLocalNormalWrite(face: BoundsFace, out: THREE.Vector3): THREE.Vector3 {
  out.set(0, 0, 0);
  return out.setComponent(boundsFaceAxisIndex(face), boundsFaceOutwardSign(face));
}

/**
 * Returns the local axis index (0 = x, 1 = y, 2 = z) of a bounds face normal.
 *
 * @param face Bounds face.
 * @returns Axis index.
 */
function boundsFaceAxisIndex(face: BoundsFace): 0 | 1 | 2 {
  const letter = boundsFaceAxisLetter(face);
  if (letter === 'x') {
    return 0;
  }
  return letter === 'y' ? 1 : 2;
}

/**
 * Returns the sign of a bounds face normal along its axis.
 *
 * @param face Bounds face.
 * @returns +1 for positive faces, −1 for negative faces.
 */
function boundsFaceOutwardSign(face: BoundsFace): 1 | -1 {
  return face === BoundsFace.POS_X || face === BoundsFace.POS_Y || face === BoundsFace.POS_Z ? 1 : -1;
}

/**
 * Sums the local outward normals of a handle's faces.
 *
 * @param faces Faces dragged by the handle.
 * @returns Local pull direction (not normalized).
 */
export function boundsHandleFacesLocalPullDirection(faces: readonly BoundsFace[]): THREE.Vector3 {
  const direction = new THREE.Vector3();
  for (const face of faces) {
    direction.add(boundsFaceLocalNormalWrite(face, scratchFaceNormal));
  }
  return direction;
}

/**
 * Writes the local point where a handle sits: on every handle face, pushed
 * outward by a gap along each face normal.
 *
 * @param faces Faces dragged by the handle.
 * @param halfExtents Bounds half extents.
 * @param outwardGap Distance past each face along its normal.
 * @param out Vector receiving the local handle position.
 * @returns The out vector.
 */
export function boundsHandleFacesLocalAnchorWrite(
  faces: readonly BoundsFace[],
  halfExtents: THREE.Vector3,
  outwardGap: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.set(0, 0, 0);
  for (const face of faces) {
    const reach = getBoundsFaceHalfExtent(halfExtents, face) + outwardGap;
    out.addScaledVector(boundsFaceLocalNormalWrite(face, scratchFaceNormal), reach);
  }
  return out;
}

/**
 * Returns the smallest half extent along the axes of a handle's faces.
 *
 * @param faces Faces dragged by the handle.
 * @param halfExtents Bounds half extents.
 * @returns Smallest half extent, or zero for an empty list.
 */
export function boundsHandleFacesSmallestHalfExtent(faces: readonly BoundsFace[], halfExtents: THREE.Vector3): number {
  if (faces.length === 0) {
    return 0;
  }
  let smallest = Number.POSITIVE_INFINITY;
  for (const face of faces) {
    smallest = Math.min(smallest, getBoundsFaceHalfExtent(halfExtents, face));
  }
  return smallest;
}

/**
 * Reads the handle face list stored on a scene object. The stored list is
 * validated once and the result is cached for that list.
 *
 * @param object Handle mesh or clone.
 * @returns Stored faces, or an empty list when the object is not a handle.
 */
export function boundsHandleFacesRead(object: THREE.Object3D): readonly BoundsFace[] {
  const stored: unknown = object.userData[BOUNDS_HANDLE_FACES_KEY];
  if (!Array.isArray(stored)) {
    return BOUNDS_HANDLE_NO_FACES;
  }
  const cached = validatedFaceListCache.get(stored);
  if (cached) {
    return cached;
  }
  const validated = stored.filter((entry): entry is BoundsFace => BOUNDS_FACE_NAMES.includes(entry));
  validatedFaceListCache.set(stored, validated);
  return validated;
}

/**
 * Stores a handle face list on a scene object.
 *
 * @param object Handle mesh.
 * @param faces Faces dragged by the handle.
 */
export function boundsHandleFacesWrite(object: THREE.Object3D, faces: readonly BoundsFace[]): void {
  object.userData[BOUNDS_HANDLE_FACES_KEY] = [...faces];
}
