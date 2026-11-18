import * as THREE from 'three';
import type { CollisionModelPiece, CollisionModelResult } from '@/level_export/collision/collision_model_result.js';
import { CollisionMeshTriangles } from '@/level_export/collision/collision_mesh_triangles.js';
import { CollisionNumberFormat } from '@/level_export/collision/collision_number_format.js';
import {
  COLLISION_MESH_PLANE_TOLERANCE,
  CollisionMeshPlaneSet,
} from '@/level_export/collision/mesh/collision_mesh_plane_set.js';
import { CollisionMeshWorldTriangles } from '@/level_export/collision/mesh/collision_mesh_world_triangles.js';

/** Smallest number of planes that can bound a convex piece. */
const COLLISION_MESH_PLANES_MIN = 4;

/**
 * Largest length of the area-weighted normal sum, relative to the total area,
 * of a mesh whose surface is closed.
 */
const COLLISION_MESH_CLOSED_RELATIVE_TOLERANCE = 1e-4;

/**
 * Collects the collision of one plain content mesh: one convex piece when the
 * mesh is a closed convex solid, else its triangles flagged as
 * `non_convex_mesh`.
 */
export class CollisionMeshCollector {
  /**
   * Collects the collision of a mesh.
   *
   * @param mesh Content mesh with a current world matrix.
   * @returns One piece, or one flagged part.
   */
  static collect(mesh: THREE.Mesh): CollisionModelResult {
    const triangles = CollisionMeshWorldTriangles.of(mesh);
    const vertices = CollisionMeshCollector.verticesUnique(triangles.flatMap((triangle) => [...triangle.corners]));
    const planeSet = new CollisionMeshPlaneSet(triangles, CollisionMeshCollector.centroidOf(vertices));
    if (CollisionMeshCollector.closedConvexIs(planeSet, vertices)) {
      return { pieces: [CollisionMeshCollector.pieceDescribe(planeSet, vertices)], flagged: [] };
    }
    return {
      pieces: [],
      flagged: [{ brush_id: '', brush_name: '', reason: 'non_convex_mesh', ...CollisionMeshTriangles.ofMesh(mesh) }],
    };
  }

  /**
   * Returns whether planes and vertices bound a closed convex solid: enough
   * planes, a closed surface, every vertex behind every plane and the centroid
   * strictly inside, all within a tolerance.
   *
   * @param planeSet Planes of the mesh's triangles.
   * @param vertices Unique world vertices.
   * @returns True for closed convex meshes.
   */
  static closedConvexIs(planeSet: CollisionMeshPlaneSet, vertices: readonly THREE.Vector3[]): boolean {
    return (
      planeSet.planes.length >= COLLISION_MESH_PLANES_MIN &&
      planeSet.areaWeightedNormalSum.length() <= planeSet.totalArea * COLLISION_MESH_CLOSED_RELATIVE_TOLERANCE &&
      vertices.every((vertex) => planeSet.frontDistanceMax(vertex) <= COLLISION_MESH_PLANE_TOLERANCE) &&
      planeSet.frontDistanceMax(CollisionMeshCollector.centroidOf(vertices)) < -COLLISION_MESH_PLANE_TOLERANCE
    );
  }

  /**
   * Returns points without the ones that round to an earlier point.
   *
   * @param points World points.
   * @returns Unique points in first-seen order.
   */
  private static verticesUnique(points: readonly THREE.Vector3[]): THREE.Vector3[] {
    const seen = new Map<string, THREE.Vector3>();
    points.forEach((point) => {
      const key = CollisionNumberFormat.vector3(point).join(',');
      if (!seen.has(key)) {
        seen.set(key, point);
      }
    });
    return [...seen.values()];
  }

  /**
   * Returns the average of points.
   *
   * @param points Points.
   * @returns Their centroid, the origin for no points.
   */
  private static centroidOf(points: readonly THREE.Vector3[]): THREE.Vector3 {
    const centroid = new THREE.Vector3();
    points.forEach((point) => centroid.add(point));
    return points.length > 0 ? centroid.divideScalar(points.length) : centroid;
  }

  /**
   * Describes the piece of a convex mesh with its planes, textures and
   * vertices.
   *
   * @param planeSet Planes of the mesh.
   * @param vertices Unique world vertices.
   * @returns Piece record without a brush.
   */
  private static pieceDescribe(
    planeSet: CollisionMeshPlaneSet,
    vertices: readonly THREE.Vector3[],
  ): CollisionModelPiece {
    return {
      brush_id: '',
      brush_name: '',
      planes: planeSet.planes.map((plane) => ({
        normal: CollisionNumberFormat.vector3(plane.normal),
        distance: CollisionNumberFormat.round(plane.distance),
        texture: plane.texture,
      })),
      vertices: vertices.map((vertex) => CollisionNumberFormat.vector3(vertex)),
    };
  }
}
