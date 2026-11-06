import * as THREE from 'three';
import type { DisplacementSculptEdge } from '@/displacement/model/displacement_types.js';
import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';

/** Vertex of a sculpt face nearest to a point. */
export interface DisplacementSculptNearestVertex {
  /** Row-major vertex index. */
  vertexIndex: number;
  /** World distance from the point to the displaced vertex. */
  distance: number;
}

/** Scratch vector for displaced vertex positions. */
const displacementSculptWeightsScratch = new THREE.Vector3();

/**
 * Returns the cosine falloff weight of a vertex inside a dab: 1 at the center,
 * easing to 0 at the radius.
 *
 * @param distance World distance from the dab center.
 * @param radius Dab radius.
 * @returns Weight between 0 and 1.
 */
export function displacementSculptFalloffCosine(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  return 0.5 * (1 + Math.cos((Math.PI * distance) / radius));
}

/**
 * Returns the hard falloff weight of a vertex: 1 inside the radius, 0 outside.
 *
 * @param distance World distance from the dab center.
 * @param radius Dab radius.
 * @returns 1 or 0.
 */
export function displacementSculptFalloffHard(distance: number, radius: number): number {
  return radius > 0 && distance <= radius ? 1 : 0;
}

/**
 * Returns the falloff weight of a vertex for a dab edge.
 *
 * @param edge Soft (cosine) or hard edge.
 * @param distance World distance from the dab center.
 * @param radius Dab radius.
 * @returns Weight between 0 and 1.
 */
export function displacementSculptFalloffRead(edge: DisplacementSculptEdge, distance: number, radius: number): number {
  return edge === 'hard'
    ? displacementSculptFalloffHard(distance, radius)
    : displacementSculptFalloffCosine(distance, radius);
}

/**
 * Lists the world distance of every displaced vertex of a face to a point.
 *
 * @param face Sculpt face.
 * @param center World point.
 * @returns Row-major distances.
 */
export function displacementSculptVertexDistancesRead(face: DisplacementSculptFace, center: THREE.Vector3): number[] {
  return face.displacement.offsets.map((_offset, vertexIndex) =>
    face.placement
      .displacedPositionWrite(face.displacement, vertexIndex, displacementSculptWeightsScratch)
      .distanceTo(center),
  );
}

/**
 * Finds the displaced vertex of a face nearest to a point.
 *
 * @param face Sculpt face.
 * @param center World point.
 * @returns Nearest vertex, or null when the face has no vertices.
 */
export function displacementSculptNearestVertexRead(
  face: DisplacementSculptFace,
  center: THREE.Vector3,
): DisplacementSculptNearestVertex | null {
  let nearest: DisplacementSculptNearestVertex | null = null;
  displacementSculptVertexDistancesRead(face, center).forEach((distance, vertexIndex) => {
    if (!nearest || distance < nearest.distance) {
      nearest = { vertexIndex, distance };
    }
  });
  return nearest;
}

/**
 * Picks the face holding the displaced vertex nearest to a point.
 *
 * @param faces Candidate sculpt faces.
 * @param center World point.
 * @returns Face with the globally nearest vertex, or null for an empty list.
 */
export function displacementSculptNearestFaceRead(
  faces: readonly DisplacementSculptFace[],
  center: THREE.Vector3,
): DisplacementSculptFace | null {
  let nearestFace: DisplacementSculptFace | null = null;
  let nearestDistance = Infinity;
  for (const face of faces) {
    const vertex = displacementSculptNearestVertexRead(face, center);
    if (vertex && vertex.distance < nearestDistance) {
      nearestFace = face;
      nearestDistance = vertex.distance;
    }
  }
  return nearestFace;
}
