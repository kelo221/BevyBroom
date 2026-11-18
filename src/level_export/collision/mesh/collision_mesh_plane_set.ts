import * as THREE from 'three';
import type { CollisionMeshWorldTriangle } from '@/level_export/collision/mesh/collision_mesh_world_triangles.js';

/**
 * Distance in meters within which points count as lying on a plane, and within
 * which two planes with the same normal are merged.
 */
export const COLLISION_MESH_PLANE_TOLERANCE = 1e-4;

/** Smallest triangle area in square meters that defines a plane. */
const COLLISION_MESH_TRIANGLE_MIN_AREA = 1e-10;

/** Smallest normal dot product of two planes that are merged. */
const COLLISION_MESH_PLANE_NORMAL_MATCH = 1 - 1e-6;

/** One plane of a mesh: `normal · p = distance`, normal pointing out. */
export interface CollisionMeshPlane {
  readonly normal: THREE.Vector3;
  readonly distance: number;
  /** Texture of the first triangle on the plane that has one. */
  texture: string;
}

/** The planes of a mesh's triangles, oriented away from an inner point. */
export class CollisionMeshPlaneSet {
  readonly planes: CollisionMeshPlane[] = [];
  /** Sum of every triangle's outward normal times its area. */
  readonly areaWeightedNormalSum = new THREE.Vector3();
  /** Sum of every triangle's area. */
  totalArea = 0;

  /**
   * Builds the planes of triangles, one plane per set of coplanar triangles.
   *
   * @param triangles World triangles.
   * @param innerPoint Point the normals point away from.
   */
  constructor(triangles: readonly CollisionMeshWorldTriangle[], innerPoint: THREE.Vector3) {
    triangles.forEach((triangle) => this.triangleAdd(triangle, innerPoint));
  }

  /**
   * Returns the largest distance of a point in front of any plane.
   *
   * @param point World point.
   * @returns Signed distance; negative when the point is behind every plane.
   */
  frontDistanceMax(point: THREE.Vector3): number {
    return this.planes.reduce(
      (largest, plane) => Math.max(largest, plane.normal.dot(point) - plane.distance),
      -Infinity,
    );
  }

  /**
   * Adds one triangle: its area to the sums and its plane to the set.
   *
   * @param triangle World triangle.
   * @param innerPoint Point the normal points away from.
   */
  private triangleAdd(triangle: CollisionMeshWorldTriangle, innerPoint: THREE.Vector3): void {
    const [first, second, third] = triangle.corners;
    const cross = new THREE.Vector3().subVectors(second, first).cross(new THREE.Vector3().subVectors(third, first));
    const area = cross.length() * 0.5;
    if (area < COLLISION_MESH_TRIANGLE_MIN_AREA) {
      return;
    }
    const normal = cross.normalize();
    if (normal.dot(innerPoint) - normal.dot(first) > 0) {
      normal.negate();
    }
    this.totalArea += area;
    this.areaWeightedNormalSum.addScaledVector(normal, area);
    this.planeMerge(normal, normal.dot(first), triangle.texture);
  }

  /**
   * Adds a plane, or gives a matching plane its texture when it has none.
   *
   * @param normal Outward unit normal.
   * @param distance Plane distance along the normal.
   * @param texture Texture of the triangle on the plane.
   */
  private planeMerge(normal: THREE.Vector3, distance: number, texture: string): void {
    const match = this.planes.find(
      (plane) =>
        plane.normal.dot(normal) > COLLISION_MESH_PLANE_NORMAL_MATCH &&
        Math.abs(plane.distance - distance) <= COLLISION_MESH_PLANE_TOLERANCE,
    );
    if (match === undefined) {
      this.planes.push({ normal, distance, texture });
    } else if (match.texture === '') {
      match.texture = texture;
    }
  }
}
