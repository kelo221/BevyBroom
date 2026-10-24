import * as THREE from 'three';
import type { TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { computeRegionWorldNormal } from '@/texture/uv/planar_uv_projector.js';
import { getTriangleVertexIndices, getVertexPosition } from '@/selection/pick/utils_triangle_geometry.js';
import { FaceUvOperationContext, type FaceUvTextureSizePixels } from './face_uv_operation_context.js';

/** Camera directions a context may carry for camera-relative operations. */
export interface FaceUvCameraDirections {
  right: THREE.Vector3;
  up: THREE.Vector3;
}

/**
 * Builds the UV operation context of one apply target region, or null when the
 * factory cannot describe the region.
 */
export type FaceUvTargetContextFactory = (target: TextureApplyTarget) => FaceUvOperationContext | null;

/** World-distance below which two region vertices count as the same corner. */
const VERTEX_WELD_DISTANCE = 1e-4;

/**
 * Creates the default target context factory: builds each region's convex world
 * polygon, its normal, and optional camera directions.
 *
 * @param cameraDirections Camera right/up for camera-relative operations, or
 *   null.
 * @param textureSizePixels Texture image size, or null when unknown.
 * @returns Factory producing per-region contexts.
 */
export function createWorldPolygonTargetContextFactory(
  cameraDirections: FaceUvCameraDirections | null,
  textureSizePixels: FaceUvTextureSizePixels | null = null,
): FaceUvTargetContextFactory {
  return (target) => faceUvOperationContextFromTarget(target, cameraDirections, textureSizePixels);
}

/**
 * Builds the UV operation context of one region from its world polygon.
 *
 * @param target Region with mesh and triangle indices.
 * @param cameraDirections Camera right/up, or null.
 * @param textureSizePixels Texture image size, or null.
 * @returns Context, or null for an empty or degenerate region.
 */
export function faceUvOperationContextFromTarget(
  target: TextureApplyTarget,
  cameraDirections: FaceUvCameraDirections | null,
  textureSizePixels: FaceUvTextureSizePixels | null,
): FaceUvOperationContext | null {
  if (target.triangleIndices.length === 0) {
    return null;
  }
  target.mesh.updateMatrixWorld(true);
  const faceNormal = computeRegionWorldNormal(target.mesh, target.triangleIndices);
  const corners = collectRegionWorldPolygon(target.mesh, target.triangleIndices, faceNormal);
  if (corners.length < 3) {
    return null;
  }
  return new FaceUvOperationContext({
    vertices: corners,
    faceNormal,
    ...(textureSizePixels ? { textureSizePixels } : {}),
    ...(cameraDirections ? { cameraRight: cameraDirections.right, cameraUp: cameraDirections.up } : {}),
  });
}

/**
 * Collects a region's unique world vertices and reduces them to its convex
 * outline wound around the face normal.
 *
 * @param mesh Region mesh.
 * @param triangleIndices Region triangles.
 * @param faceNormal Unit world normal of the region.
 * @returns Convex outline vertices in winding order.
 */
function collectRegionWorldPolygon(
  mesh: THREE.Mesh,
  triangleIndices: number[],
  faceNormal: THREE.Vector3,
): THREE.Vector3[] {
  const uniqueVertices = collectUniqueWorldVertices(mesh, triangleIndices);
  if (uniqueVertices.length < 3) {
    return [];
  }
  return buildConvexOutlineAroundNormal(uniqueVertices, faceNormal);
}

/**
 * Collects the welded world vertices used by a triangle region.
 *
 * @param mesh Region mesh.
 * @param triangleIndices Region triangles.
 * @returns Unique world vertices.
 */
function collectUniqueWorldVertices(mesh: THREE.Mesh, triangleIndices: number[]): THREE.Vector3[] {
  const position = mesh.geometry.getAttribute('position');
  if (!position) {
    return [];
  }
  const vertices: THREE.Vector3[] = [];
  const seenKeys = new Set<string>();
  triangleIndices.forEach((triangleIndex) => {
    getTriangleVertexIndices(mesh.geometry, triangleIndex).forEach((vertexIndex) => {
      const world = getVertexPosition(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
      const key = worldVertexKey(world);
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);
      vertices.push(world);
    });
  });
  return vertices;
}

/**
 * Builds a stable weld key for a world vertex.
 *
 * @param world World vertex.
 * @returns Quantized position key.
 */
function worldVertexKey(world: THREE.Vector3): string {
  const scale = 1 / VERTEX_WELD_DISTANCE;
  return `${Math.round(world.x * scale)},${Math.round(world.y * scale)},${Math.round(world.z * scale)}`;
}

/**
 * Reduces a vertex cloud to its convex outline wound counter-clockwise around a
 * plane normal.
 *
 * @param vertices Vertex cloud on the plane.
 * @param faceNormal Unit plane normal.
 * @returns Outline vertices in winding order around the normal.
 */
function buildConvexOutlineAroundNormal(vertices: THREE.Vector3[], faceNormal: THREE.Vector3): THREE.Vector3[] {
  const basis = buildOutlinePlaneBasis(faceNormal);
  const points = vertices.map((vertex) => ({
    vertex,
    x: vertex.dot(basis.uAxis),
    y: vertex.dot(basis.vAxis),
  }));
  const hull = convexHullInPlane(points);
  if (hull.length < 3) {
    return [];
  }
  return orientOutlineAroundNormal(hull, faceNormal);
}

/**
 * Builds two in-plane axes used to flatten the vertex cloud.
 *
 * @param faceNormal Unit plane normal.
 * @returns Orthonormal in-plane axes.
 */
function buildOutlinePlaneBasis(faceNormal: THREE.Vector3): { uAxis: THREE.Vector3; vAxis: THREE.Vector3 } {
  const uAxis = new THREE.Vector3(1, 0, 0);
  if (Math.abs(faceNormal.x) > 0.9) {
    uAxis.set(0, 1, 0);
  }
  const vAxis = new THREE.Vector3().crossVectors(faceNormal, uAxis).normalize();
  uAxis.crossVectors(vAxis, faceNormal).normalize();
  return { uAxis, vAxis };
}

/** One flattened vertex of a region cloud. */
interface OutlinePlanePoint {
  vertex: THREE.Vector3;
  x: number;
  y: number;
}

/**
 * Computes the convex hull of a flattened vertex cloud (monotone chain).
 *
 * @param points Flattened vertices.
 * @returns Hull points in counter-clockwise order.
 */
function convexHullInPlane(points: OutlinePlanePoint[]): OutlinePlanePoint[] {
  const sorted = points.slice().sort((left, right) => left.x - right.x || left.y - right.y);
  const lower = hullChainBuild(sorted);
  const upper = hullChainBuild(sorted.slice().reverse());
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Builds one monotone chain of the hull from points visited in the given order.
 *
 * @param visited Points in the order this chain visits them.
 * @returns Chain points, both sweep-end points included.
 */
function hullChainBuild(visited: OutlinePlanePoint[]): OutlinePlanePoint[] {
  const chain: OutlinePlanePoint[] = [];
  visited.forEach((point) => {
    while (chain.length >= 2 && hullTurnIsClockwise(chain, point)) {
      chain.pop();
    }
    chain.push(point);
  });
  return chain;
}

/**
 * Returns whether appending a point to a hull chain would make a clockwise
 * turn.
 *
 * @param chain Hull chain so far.
 * @param point Candidate point.
 * @returns True when the turn is clockwise or straight.
 */
function hullTurnIsClockwise(chain: OutlinePlanePoint[], point: OutlinePlanePoint): boolean {
  const first = chain[chain.length - 2];
  const second = chain[chain.length - 1];
  if (!first || !second) {
    return false;
  }
  const cross = (second.x - first.x) * (point.y - first.y) - (second.y - first.y) * (point.x - first.x);
  return cross <= 0;
}

/**
 * Returns the outline wound counter-clockwise around the plane normal when seen
 * from its side.
 *
 * @param hull Convex hull in plane coordinates.
 * @param faceNormal Unit plane normal.
 * @returns Outline vertices in winding order.
 */
function orientOutlineAroundNormal(hull: OutlinePlanePoint[], faceNormal: THREE.Vector3): THREE.Vector3[] {
  const vertices = hull.map((point) => point.vertex);
  const first = vertices[0];
  const second = vertices[1];
  const third = vertices[2];
  if (!first || !second || !third) {
    return [];
  }
  const winding = new THREE.Vector3().subVectors(second, first).cross(new THREE.Vector3().subVectors(third, first));
  if (winding.dot(faceNormal) < 0) {
    vertices.reverse();
  }
  return vertices;
}
