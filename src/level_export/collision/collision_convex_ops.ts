import * as THREE from 'three';
import { SolidBrushPlaneClip } from '@/solid/brush/solid_brush_plane_clip.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidPlane } from '@/solid/brush/solid_plane.js';

/**
 * Smallest volume a convex piece keeps, in cubic meters; thinner slivers are
 * dropped.
 */
export const COLLISION_CONVEX_MIN_VOLUME = 1e-6;

/**
 * Boolean operations on convex polyhedra that keep every result convex: a
 * difference becomes several convex pieces, an intersection stays one.
 */
export class CollisionConvexOps {
  /**
   * Returns the convex pieces of a convex polyhedron that lie outside another:
   * for each plane of the cutter, the part beyond that plane is split off as a
   * piece, and the rest goes on to the next plane.
   *
   * @param subject Convex polyhedron to cut.
   * @param cutter Convex polyhedron carved away.
   * @returns Convex pieces of the difference, the subject itself when they do
   *   not overlap.
   */
  static subtract(subject: SolidBrush, cutter: SolidBrush): SolidBrush[] {
    if (!CollisionConvexOps.overlapIs(subject, cutter)) {
      return [subject];
    }
    const pieces: SolidBrush[] = [];
    let remainder: SolidBrush | null = subject;
    for (const plane of cutter.planes) {
      if (remainder === null) {
        break;
      }
      const outside = SolidBrushPlaneClip.clipKeepInside(remainder, CollisionConvexOps.planeFlip(plane));
      if (outside !== null && CollisionConvexOps.volumeOf(outside) > COLLISION_CONVEX_MIN_VOLUME) {
        pieces.push(outside);
      }
      remainder = SolidBrushPlaneClip.clipKeepInside(remainder, plane);
    }
    return pieces;
  }

  /**
   * Returns the common part of two convex polyhedra.
   *
   * @param subject First polyhedron.
   * @param other Second polyhedron.
   * @returns Their intersection, or null when it has no volume.
   */
  static intersect(subject: SolidBrush, other: SolidBrush): SolidBrush | null {
    if (!CollisionConvexOps.overlapIs(subject, other)) {
      return null;
    }
    let current: SolidBrush | null = subject;
    for (const plane of other.planes) {
      current = current === null ? null : SolidBrushPlaneClip.clipKeepInside(current, plane);
    }
    return current !== null && CollisionConvexOps.volumeOf(current) > COLLISION_CONVEX_MIN_VOLUME ? current : null;
  }

  /**
   * Returns the volume of a closed convex polyhedron from its faces.
   *
   * @param brush Convex polyhedron with outward faces.
   * @returns Volume in cubic meters.
   */
  static volumeOf(brush: SolidBrush): number {
    let sixTimesVolume = 0;
    const origin = brush.vertices[0] ?? new THREE.Vector3();
    for (const face of brush.faces) {
      const loop = brush.getFaceVertices(face);
      for (let index = 1; index + 1 < loop.length; index++) {
        sixTimesVolume += CollisionConvexOps.tetrahedronSixVolume(origin, loop[0], loop[index], loop[index + 1]);
      }
    }
    return Math.abs(sixTimesVolume) / 6;
  }

  /**
   * Returns whether the bounding boxes of two polyhedra overlap with a volume.
   *
   * @param first First polyhedron.
   * @param second Second polyhedron.
   * @returns True when the boxes overlap by more than a hair.
   */
  private static overlapIs(first: SolidBrush, second: SolidBrush): boolean {
    const firstBounds = first.computeLocalBounds();
    const secondBounds = second.computeLocalBounds().expandByScalar(-1e-6);
    return firstBounds.intersectsBox(secondBounds);
  }

  /**
   * Returns a plane facing the other way.
   *
   * @param plane Plane.
   * @returns Plane whose inside is the outside of the given one.
   */
  private static planeFlip(plane: SolidPlane): SolidPlane {
    return new SolidPlane(plane.normal.clone().negate(), -plane.offset);
  }

  /**
   * Returns six times the signed volume of a tetrahedron.
   *
   * @param origin Shared apex.
   * @param first First triangle corner.
   * @param second Second triangle corner.
   * @param third Third triangle corner.
   * @returns Six times the signed volume, or zero for missing corners.
   */
  private static tetrahedronSixVolume(
    origin: THREE.Vector3,
    first: THREE.Vector3 | undefined,
    second: THREE.Vector3 | undefined,
    third: THREE.Vector3 | undefined,
  ): number {
    if (!first || !second || !third) {
      return 0;
    }
    const a = first.clone().sub(origin);
    const b = second.clone().sub(origin);
    const c = third.clone().sub(origin);
    return a.dot(b.cross(c));
  }
}
