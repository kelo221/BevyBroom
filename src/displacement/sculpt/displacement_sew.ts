import * as THREE from 'three';
import { displacementOffsetDeltaForDistance } from '@/displacement/model/displacement_face_surface.js';
import { displacementVertexOnBorderIs } from '@/displacement/grid/displacement_grid_neighborhood.js';
import type { DisplacementSculptFace } from './displacement_sculpt_face.js';
import { DisplacementSewPointClusters } from './displacement_sew_point_clusters.js';

/** Largest distance, in meters, between border vertices that are sewn together. */
const DISPLACEMENT_SEW_POSITION_TOLERANCE = 1e-3;

/** One border vertex of one sculpt face. */
interface DisplacementSewVertex {
  face: DisplacementSculptFace;
  vertexIndex: number;
}

/**
 * Sews displacements along shared edges: border vertices of different faces
 * that sit on the same flat world position move to their averaged displaced
 * position, as far as each vertex can move along its own face normal.
 */
export class DisplacementSew {
  /**
   * Sews every shared border of the given faces.
   *
   * @param faces Sculpt faces in world space, possibly on different brushes.
   * @returns Faces whose offsets changed.
   */
  static sewSharedEdges(faces: readonly DisplacementSculptFace[]): DisplacementSculptFace[] {
    const changed = new Set<DisplacementSculptFace>();
    for (const group of DisplacementSew.borderGroupsCollect(faces)) {
      if (new Set(group.map((entry) => entry.face)).size < 2) {
        continue;
      }
      DisplacementSew.groupSew(group, changed);
    }
    return [...changed];
  }

  /**
   * Groups the border vertices of every face whose flat world positions lie
   * within the sew tolerance of each other.
   *
   * @param faces Sculpt faces.
   * @returns Border vertex groups.
   */
  private static borderGroupsCollect(faces: readonly DisplacementSculptFace[]): DisplacementSewVertex[][] {
    const clusters = new DisplacementSewPointClusters<DisplacementSewVertex>(DISPLACEMENT_SEW_POSITION_TOLERANCE);
    for (const face of faces) {
      face.placement.basePositions.forEach((base, vertexIndex) => {
        if (displacementVertexOnBorderIs(face.rowLength(), vertexIndex)) {
          clusters.add(base, { face, vertexIndex });
        }
      });
    }
    return clusters.groupsRead();
  }

  /**
   * Moves every vertex of one coincident group to the group's mean displaced
   * position.
   *
   * @param group Coincident border vertices.
   * @param changed Accumulator receiving faces whose offsets changed.
   */
  private static groupSew(group: readonly DisplacementSewVertex[], changed: Set<DisplacementSculptFace>): void {
    const mean = new THREE.Vector3();
    const scratch = new THREE.Vector3();
    for (const entry of group) {
      mean.add(entry.face.placement.displacedPositionWrite(entry.face.displacement, entry.vertexIndex, scratch));
    }
    mean.divideScalar(group.length);
    for (const entry of group) {
      if (DisplacementSew.vertexMoveTowards(entry, mean, scratch)) {
        changed.add(entry.face);
      }
    }
  }

  /**
   * Sets one vertex offset so the vertex lies as close to a target as its face
   * normal allows.
   *
   * @param entry Border vertex.
   * @param target World-space target position.
   * @param scratch Scratch vector.
   * @returns True when the offset changed.
   */
  private static vertexMoveTowards(
    entry: DisplacementSewVertex,
    target: THREE.Vector3,
    scratch: THREE.Vector3,
  ): boolean {
    const displacement = entry.face.displacement;
    const base = entry.face.placement.basePositions[entry.vertexIndex];
    if (!base) return false;
    const height = scratch.subVectors(target, base).dot(entry.face.placement.normal);
    const next = displacementOffsetDeltaForDistance(displacement, height - displacement.elevation);
    const previous = displacement.offsets[entry.vertexIndex] ?? 0;
    displacement.offsets[entry.vertexIndex] = next;
    return Math.abs(next - previous) > 1e-9;
  }
}
