import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralGeometryBuilder } from '@/procedural/build/procedural_geometry_builder.js';

/** Distance below which points count as on a plane, in meters. */
const PROCEDURAL_PART_TEST_TOLERANCE = 1e-6;

/**
 * Returns whether every face of a part is planar and every corner of the part
 * lies behind or on every face plane, which makes the part a closed convex
 * piece with outward faces.
 *
 * @param part Generated part.
 * @returns True for convex parts.
 */
export function proceduralPartConvexIs(part: ProceduralPart): boolean {
  const corners = part.faces.flat();
  return part.faces.every((face) => {
    const first = face[0];
    const normal = ProceduralGeometryBuilder.faceNormal(face);
    if (first === undefined || normal.lengthSq() === 0) {
      return false;
    }
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, first);
    const isPlanar = face.every((corner) => Math.abs(plane.distanceToPoint(corner)) < PROCEDURAL_PART_TEST_TOLERANCE);
    return isPlanar && corners.every((corner) => plane.distanceToPoint(corner) < PROCEDURAL_PART_TEST_TOLERANCE);
  });
}

/**
 * Returns the bounding box of a part.
 *
 * @param part Generated part.
 * @returns Box around every corner.
 */
export function proceduralPartBoundsOf(part: ProceduralPart): THREE.Box3 {
  return new THREE.Box3().setFromPoints(part.faces.flat());
}
