import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import type { DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';

/** Smallest bounds extent a shear can act on. */
const SHEAR_MIN_EXTENT = 1e-6;

/** World axes a numeric shear can use. */
export type ShearAxisName = 'x' | 'y' | 'z';

/**
 * Returns the local axis index of a bounds face.
 *
 * @param face Bounds face.
 * @returns 0 for X faces, 1 for Y faces, 2 for Z faces.
 */
export function shearFaceAxisIndex(face: BoundsFace): number {
  if (face === BoundsFace.POS_X || face === BoundsFace.NEG_X) {
    return 0;
  }
  if (face === BoundsFace.POS_Y || face === BoundsFace.NEG_Y) {
    return 1;
  }
  return 2;
}

/**
 * Returns the sign of a bounds face along its axis.
 *
 * @param face Bounds face.
 * @returns 1 for positive faces, -1 for negative faces.
 */
export function shearFaceSign(face: BoundsFace): number {
  return face === BoundsFace.POS_X || face === BoundsFace.POS_Y || face === BoundsFace.POS_Z ? 1 : -1;
}

/**
 * Returns the local axis index a slide direction maps onto.
 *
 * @param bounds Bounds owning the face.
 * @param face Face being sheared.
 * @param slideWorld World-space slide direction.
 * @returns Axis index (0, 1, or 2) other than the face axis, or -1 when the
 *   direction lies along the face normal.
 */
export function shearSlideAxisIndex(bounds: DataOrientedBounds, face: BoundsFace, slideWorld: THREE.Vector3): number {
  const faceAxis = shearFaceAxisIndex(face);
  const direction = slideWorld.clone().normalize();
  let best = -1;
  let bestAlignment = Number.EPSILON;
  for (let index = 0; index < 3; index += 1) {
    if (index === faceAxis) {
      continue;
    }
    const axisWorld = new THREE.Vector3().setComponent(index, 1).applyQuaternion(bounds.quaternion);
    const alignment = Math.abs(axisWorld.normalize().dot(direction));
    if (alignment > bestAlignment) {
      bestAlignment = alignment;
      best = index;
    }
  }
  return best;
}

/**
 * Builds the world-space shear matrix that slides one bounds face along a
 * direction while the opposite face stays fixed.
 *
 * @param bounds Oriented bounds at drag start.
 * @param face Face that slides.
 * @param slideWorld World-space slide direction.
 * @param offsetWorld Slide distance in world units along the direction sign.
 * @returns Shear matrix, or null when the bounds or direction degenerate.
 */
export function shearMatrixFromBoundsSlide(
  bounds: DataOrientedBounds,
  face: BoundsFace,
  slideWorld: THREE.Vector3,
  offsetWorld: number,
): THREE.Matrix4 | null {
  const slideIndex = shearSlideAxisIndex(bounds, face, slideWorld);
  if (slideIndex < 0) {
    return null;
  }
  const faceAxis = shearFaceAxisIndex(face);
  const extent = bounds.halfExtents.getComponent(faceAxis) * 2;
  if (extent < SHEAR_MIN_EXTENT) {
    return null;
  }
  const anchor = -shearFaceSign(face) * bounds.halfExtents.getComponent(faceAxis);
  const slope = offsetWorld / extent;
  return shearMatrixAssemble(bounds, slideIndex, faceAxis, slope, anchor);
}

/**
 * Builds the world-space shear matrix of a world-axis box.
 *
 * @param boxMin World box minimum corner.
 * @param boxMax World box maximum corner.
 * @param axis Axis whose positive side slides.
 * @param along Axis the side slides along.
 * @param offset Slide distance of the positive side in world units.
 * @returns Shear matrix, or null when the axes match or the box is flat.
 */
export function shearMatrixFromWorldBox(
  boxMin: THREE.Vector3,
  boxMax: THREE.Vector3,
  axis: ShearAxisName,
  along: ShearAxisName,
  offset: number,
): THREE.Matrix4 | null {
  const axisIndex = shearAxisNameIndex(axis);
  const slideIndex = shearAxisNameIndex(along);
  if (axisIndex === slideIndex) {
    return null;
  }
  const extent = boxMax.getComponent(axisIndex) - boxMin.getComponent(axisIndex);
  if (extent < SHEAR_MIN_EXTENT) {
    return null;
  }
  const slope = offset / extent;
  const anchor = boxMin.getComponent(axisIndex);
  const center = new THREE.Vector3().addVectors(boxMin, boxMax).multiplyScalar(0.5);
  const halfExtents = new THREE.Vector3().subVectors(boxMax, boxMin).multiplyScalar(0.5);
  return shearMatrixAssemble(
    { center, quaternion: new THREE.Quaternion(), halfExtents },
    slideIndex,
    axisIndex,
    slope,
    anchor - center.getComponent(axisIndex),
  );
}

/**
 * Returns the index of a world axis name.
 *
 * @param name Axis name.
 * @returns 0 for x, 1 for y, 2 for z.
 */
function shearAxisNameIndex(name: ShearAxisName): number {
  return name === 'x' ? 0 : name === 'y' ? 1 : 2;
}

/**
 * Assembles the world shear matrix from bounds-frame parts.
 *
 * @param bounds Oriented bounds the shear acts on.
 * @param slideIndex Local axis the face slides along.
 * @param faceAxis Local axis the face is perpendicular to.
 * @param slope Slide distance per unit of face-axis extent.
 * @param anchor Face-axis coordinate (relative to center) that stays fixed.
 * @returns World-space shear matrix.
 */
function shearMatrixAssemble(
  bounds: DataOrientedBounds,
  slideIndex: number,
  faceAxis: number,
  slope: number,
  anchor: number,
): THREE.Matrix4 {
  const local = shearLocalMatrixBuild(slideIndex, faceAxis, slope, anchor);
  const frame = new THREE.Matrix4().compose(bounds.center, bounds.quaternion, new THREE.Vector3(1, 1, 1));
  return frame.clone().multiply(local).multiply(frame.clone().invert());
}

/**
 * Builds the bounds-local shear matrix.
 *
 * @param slideIndex Local axis the face slides along.
 * @param faceAxis Local axis the face is perpendicular to.
 * @param slope Slide distance per unit of face-axis extent.
 * @param anchor Face-axis coordinate that stays fixed.
 * @returns Local shear matrix.
 */
function shearLocalMatrixBuild(slideIndex: number, faceAxis: number, slope: number, anchor: number): THREE.Matrix4 {
  const rows = [0, 1, 2].map((row) => [0, 1, 2].map((column) => (row === column ? 1 : 0)));
  rows[slideIndex]![faceAxis]! += slope;
  const translation = [0, 0, 0];
  translation[slideIndex] = -slope * anchor;
  return new THREE.Matrix4().set(
    rows[0]![0]!,
    rows[0]![1]!,
    rows[0]![2]!,
    translation[0]!,
    rows[1]![0]!,
    rows[1]![1]!,
    rows[1]![2]!,
    translation[1]!,
    rows[2]![0]!,
    rows[2]![1]!,
    rows[2]![2]!,
    translation[2]!,
    0,
    0,
    0,
    1,
  );
}
