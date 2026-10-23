import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext, FaceUvPoint } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import { faceUvRowDirection } from './face_uv_operation_math.js';

/** How the aligned edge is chosen. */
export type FaceUvAlignEdgeMode = 'best' | 'next' | 'previous';

/** Minimum UV length for an edge direction to count as usable. */
const EDGE_DIRECTION_MIN_LENGTH = 1e-12;

/**
 * Rotates the texture axes in the face plane so the U axis aligns with one
 * polygon edge: the edge whose direction is closest to U, or a step to the
 * following/preceding edge from it. Row directions rotate about the plane
 * normal; offsets and scale magnitudes are unchanged.
 */
export class FaceUvOperationAlignEdge extends FaceUvOperation {
  private readonly mode: FaceUvAlignEdgeMode;

  /**
   * Creates an align-edge operation.
   *
   * @param mode Edge selection: best (closest to U), next, or previous.
   */
  constructor(mode: FaceUvAlignEdgeMode = 'best') {
    super();
    this.mode = mode;
  }

  /**
   * Aligns the matrix U axis with the chosen face edge.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon whose edges are aligned to.
   * @returns Matrix with the U axis along the chosen edge, or the input when no
   *   usable edge exists.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    const edgeIndex = this.resolveTargetEdgeIndex(matrix, context);
    const edgeDirection = edgeIndex === null ? null : context.faceEdgeWorldDirection(edgeIndex);
    if (edgeIndex === null || !edgeDirection || edgeDirection.lengthSq() < EDGE_DIRECTION_MIN_LENGTH) {
      return matrix;
    }
    const planeNormal = matrix.planeNormalAlignedTo(context.faceNormal);
    const axisAngle = this.measureRotationToEdge(matrix, edgeDirection, planeNormal);
    return this.rotateRowDirections(matrix, planeNormal, axisAngle);
  }

  /**
   * Resolves which polygon edge the U axis aligns with after this operation.
   *
   * @param matrix Current UV matrix.
   * @param context Face polygon providing the edges.
   * @returns Edge index, or null when no edge has a usable UV direction.
   */
  private resolveTargetEdgeIndex(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): number | null {
    const edgeCount = context.faceEdgeCount();
    const baseIndex = findEdgeClosestToUAxis(context.faceEdgeUvDirections(matrix));
    if (baseIndex === null || this.mode === 'best') {
      return baseIndex;
    }
    if (this.mode === 'next') {
      return (baseIndex + 1) % edgeCount;
    }
    return (baseIndex - 1 + edgeCount) % edgeCount;
  }

  /**
   * Measures the in-plane rotation that turns the U row direction onto an edge
   * direction.
   *
   * @param matrix Current UV matrix.
   * @param edgeDirection World direction of the target edge.
   * @param planeNormal Plane normal the rotation happens around.
   * @returns Rotation angle in radians.
   */
  private measureRotationToEdge(
    matrix: SurfaceUvMatrix,
    edgeDirection: THREE.Vector3,
    planeNormal: THREE.Vector3,
  ): number {
    const uDirection = faceUvRowDirection(matrix.u);
    const edgeUnit = edgeDirection.clone().normalize();
    const cosine = THREE.MathUtils.clamp(uDirection.dot(edgeUnit), -1, 1);
    const sine = new THREE.Vector3().crossVectors(uDirection, edgeUnit).dot(planeNormal);
    return Math.atan2(sine, cosine);
  }

  /**
   * Rotates both row directions around the plane normal, leaving offsets
   * untouched.
   *
   * @param matrix Source matrix.
   * @param planeNormal Rotation axis (unit).
   * @param angleRad Rotation angle in radians.
   * @returns Matrix with rotated row directions.
   */
  private rotateRowDirections(matrix: SurfaceUvMatrix, planeNormal: THREE.Vector3, angleRad: number): SurfaceUvMatrix {
    const rotation = new THREE.Quaternion().setFromAxisAngle(planeNormal, angleRad);
    const uRow = rowDirectionRotate(matrix.u, rotation);
    const vRow = rowDirectionRotate(matrix.v, rotation);
    return new SurfaceUvMatrix(uRow, vRow);
  }
}

/**
 * Rotates one row's direction vector by a quaternion, keeping its offset.
 *
 * @param row Source row.
 * @param rotation Rotation applied to the row direction.
 * @returns Rotated row.
 */
function rowDirectionRotate(row: THREE.Vector4, rotation: THREE.Quaternion): THREE.Vector4 {
  const direction = new THREE.Vector3(row.x, row.y, row.z).applyQuaternion(rotation);
  return new THREE.Vector4(direction.x, direction.y, direction.z, row.w);
}

/**
 * Finds the polygon edge whose UV direction is closest to the +U direction.
 *
 * @param edgeUvDirections UV direction per edge (unnormalized).
 * @returns Edge index, or null when no edge has a measurable direction.
 */
function findEdgeClosestToUAxis(edgeUvDirections: FaceUvPoint[]): number | null {
  let bestIndex: number | null = null;
  let bestScore = -Infinity;
  edgeUvDirections.forEach((direction, index) => {
    const length = Math.hypot(direction.u, direction.v);
    if (length < EDGE_DIRECTION_MIN_LENGTH) {
      return;
    }
    const score = direction.u / length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}
