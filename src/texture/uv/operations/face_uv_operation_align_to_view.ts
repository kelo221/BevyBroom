import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import { faceUvRowMagnitude } from './face_uv_operation_math.js';

/** Squared length below which a projected camera axis counts as degenerate. */
const ALIGN_TO_VIEW_DEGENERATE_LENGTH_SQ = 1e-12;

/** In-plane U and V directions of a view projection. */
interface AlignToViewPlaneAxes {
  readonly uAxis: THREE.Vector3;
  readonly vAxis: THREE.Vector3;
}

/**
 * Projects the texture onto the face from the camera like a slide projector:
 * the U row follows camera right and the V row camera up, both projected onto
 * the face plane, at the face's current U and V texture scale. The offsets are
 * chosen so every face aligned from the same view shows one continuous image
 * anchored at the world origin.
 */
export class FaceUvOperationAlignToView extends FaceUvOperation {
  /**
   * Builds the view projection of one face.
   *
   * @param matrix Current UV matrix; only its row magnitudes (texture scale)
   *   are kept.
   * @param context Face context carrying the camera right and up directions.
   * @returns View projection matrix, or the input when the camera is missing or
   *   looks along the face plane.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    if (!context.cameraRight || !context.cameraUp) {
      return matrix;
    }
    const axes = alignToViewPlaneAxesResolve(context.cameraRight, context.cameraUp, context.faceNormal);
    if (!axes) {
      return matrix;
    }
    const planePoint = context.worldCentroid();
    return new SurfaceUvMatrix(
      alignToViewRowBuild(axes.uAxis, faceUvRowMagnitude(matrix.u), context.cameraRight, planePoint),
      alignToViewRowBuild(axes.vAxis, faceUvRowMagnitude(matrix.v), context.cameraUp, planePoint),
    );
  }
}

/**
 * Removes the face normal component from a direction.
 *
 * @param direction World direction.
 * @param faceNormal Unit face normal.
 * @returns Direction projected onto the face plane (not normalized).
 */
export function alignToViewProjectOntoPlane(direction: THREE.Vector3, faceNormal: THREE.Vector3): THREE.Vector3 {
  return direction.clone().addScaledVector(faceNormal, -direction.dot(faceNormal));
}

/**
 * Resolves the in-plane U and V directions from camera right and up. When one
 * camera axis lies along the face normal, the other in-plane axis completes the
 * frame.
 *
 * @param cameraRight Camera right direction.
 * @param cameraUp Camera up direction.
 * @param faceNormal Unit face normal.
 * @returns In-plane unit axes, or null when neither camera axis spans the face.
 */
function alignToViewPlaneAxesResolve(
  cameraRight: THREE.Vector3,
  cameraUp: THREE.Vector3,
  faceNormal: THREE.Vector3,
): AlignToViewPlaneAxes | null {
  const right = alignToViewProjectOntoPlane(cameraRight.clone().normalize(), faceNormal);
  const up = alignToViewProjectOntoPlane(cameraUp.clone().normalize(), faceNormal);
  const rightUsable = right.lengthSq() > ALIGN_TO_VIEW_DEGENERATE_LENGTH_SQ;
  const upUsable = up.lengthSq() > ALIGN_TO_VIEW_DEGENERATE_LENGTH_SQ;
  if (rightUsable && upUsable) {
    return { uAxis: right, vAxis: up };
  }
  if (rightUsable) {
    return { uAxis: right, vAxis: new THREE.Vector3().crossVectors(faceNormal, right.clone().normalize()) };
  }
  if (upUsable) {
    return { uAxis: new THREE.Vector3().crossVectors(up.clone().normalize(), faceNormal), vAxis: up };
  }
  return null;
}

/**
 * Builds one projector row: the in-plane axis at the given texture scale, with
 * an offset that matches the unprojected camera axis on the face plane.
 *
 * @param planeAxis In-plane projected camera axis.
 * @param rowMagnitude UV units per meter of the face's current row.
 * @param cameraAxis Unprojected camera axis the row stands in for.
 * @param planePoint Any world point on the face plane.
 * @returns Matrix row.
 */
function alignToViewRowBuild(
  planeAxis: THREE.Vector3,
  rowMagnitude: number,
  cameraAxis: THREE.Vector3,
  planePoint: THREE.Vector3,
): THREE.Vector4 {
  const unitCameraAxis = cameraAxis.clone().normalize();
  const direction = planeAxis.clone().multiplyScalar(rowMagnitude);
  const cameraValue = unitCameraAxis.dot(planePoint) * rowMagnitude;
  const offset = cameraValue - direction.dot(planePoint);
  return new THREE.Vector4(direction.x, direction.y, direction.z, offset);
}
