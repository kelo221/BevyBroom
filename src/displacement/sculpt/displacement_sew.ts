import * as THREE from 'three';
import { displacementOffsetDeltaForDistance } from '@/displacement/model/displacement_face_surface.js';
import { displacementSeamOffsetWrite } from '@/displacement/model/displacement_seam_offsets.js';
import { displacementVertexOnBorderIs } from '@/displacement/grid/displacement_grid_neighborhood.js';
import type { DisplacementSculptFace } from './displacement_sculpt_face.js';
import { DisplacementSewPointClusters } from './displacement_sew_point_clusters.js';

/** Largest distance, in meters, between border vertices that are sewn together. */
const DISPLACEMENT_SEW_POSITION_TOLERANCE = 1e-3;

/** Largest offset change that still counts as no change. */
const DISPLACEMENT_SEW_OFFSET_EPSILON = 1e-9;

/** One border vertex of one sculpt face. */
export interface DisplacementSewVertex {
  /** Face owning the vertex. */
  face: DisplacementSculptFace;
  /** Row-major vertex index. */
  vertexIndex: number;
}

/**
 * Sews displacements along shared edges: border vertices of different faces
 * that sit on the same flat world position move exactly to their averaged
 * displaced position, along their own face normal through the offset and across
 * it through the seam offset.
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
  static borderGroupsCollect(faces: readonly DisplacementSculptFace[]): DisplacementSewVertex[][] {
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
   * Moves one vertex exactly onto a target: the offset takes the part along the
   * face normal and the seam offset replaces the old one with the rest.
   *
   * @param entry Border vertex.
   * @param target World-space target position.
   * @param scratch Scratch vector.
   * @returns True when the offset or the seam offset changed.
   */
  private static vertexMoveTowards(
    entry: DisplacementSewVertex,
    target: THREE.Vector3,
    scratch: THREE.Vector3,
  ): boolean {
    const offsetChanged = DisplacementSew.vertexOffsetMoveTowards(entry, target, scratch);
    const seamChanged = DisplacementSew.vertexSeamOffsetMoveTowards(entry, target, scratch);
    return offsetChanged || seamChanged;
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
  private static vertexOffsetMoveTowards(
    entry: DisplacementSewVertex,
    target: THREE.Vector3,
    scratch: THREE.Vector3,
  ): boolean {
    const displacement = entry.face.displacement;
    const base = entry.face.placement.basePositions[entry.vertexIndex];
    if (!base) {
      return false;
    }
    const height = scratch.subVectors(target, base).dot(entry.face.placement.normal);
    const next = displacementOffsetDeltaForDistance(displacement, height - displacement.elevation);
    const previous = displacement.offsets[entry.vertexIndex] ?? 0;
    displacement.offsets[entry.vertexIndex] = next;
    return Math.abs(next - previous) > DISPLACEMENT_SEW_OFFSET_EPSILON;
  }

  /**
   * Replaces the seam offset of one vertex with whatever separates its position
   * along the face normal from a target.
   *
   * @param entry Border vertex whose offset already holds its height.
   * @param target World-space target position.
   * @param scratch Scratch vector.
   * @returns True when the seam offset changed.
   */
  private static vertexSeamOffsetMoveTowards(
    entry: DisplacementSewVertex,
    target: THREE.Vector3,
    scratch: THREE.Vector3,
  ): boolean {
    const placement = entry.face.placement;
    placement.heightPositionWrite(entry.face.displacement, entry.vertexIndex, scratch);
    const seamOffset = placement.seamOffsetFromSpaceWrite(scratch.subVectors(target, scratch));
    return displacementSeamOffsetWrite(entry.face.displacement, entry.vertexIndex, seamOffset);
  }
}
