import * as THREE from 'three';
import { SURFACE_UV_MIN_SCALE, SurfaceUvMatrix } from './surface_uv_matrix.js';

/**
 * 2×3 unit or scaled UV projection axis vectors shown in the Hammer++ Face Edit
 * Sheet.
 */
export interface SurfaceUvVectors2x3 {
  /** U projection axis direction `(ux, uy, uz)`. */
  uAxis: [number, number, number];
  /** V projection axis direction `(vx, vy, vz)`. */
  vAxis: [number, number, number];
}

/**
 * Extracts normalized 2×3 U and V axis direction vectors from a
 * `SurfaceUvMatrix`.
 *
 * @param matrix Source UV matrix.
 * @returns Normalized U and V 3D direction tuples.
 */
export function surfaceUvVectors2x3Read(matrix: SurfaceUvMatrix): SurfaceUvVectors2x3 {
  const uVec = new THREE.Vector3(matrix.u.x, matrix.u.y, matrix.u.z);
  const vVec = new THREE.Vector3(matrix.v.x, matrix.v.y, matrix.v.z);
  if (uVec.lengthSq() > 1e-12) {
    uVec.normalize();
  }
  if (vVec.lengthSq() > 1e-12) {
    vVec.normalize();
  }
  return {
    uAxis: [roundAxisComponent(uVec.x), roundAxisComponent(uVec.y), roundAxisComponent(uVec.z)],
    vAxis: [roundAxisComponent(vVec.x), roundAxisComponent(vVec.y), roundAxisComponent(vVec.z)],
  };
}

/**
 * Returns a new `SurfaceUvMatrix` with updated U and V 3D axis directions while
 * preserving the existing U/V scale magnitudes and translation offsets (`w`).
 *
 * @param matrix Existing UV matrix.
 * @param vectors New U and V direction vectors.
 * @returns Updated UV matrix.
 */
export function surfaceUvVectors2x3Write(matrix: SurfaceUvMatrix, vectors: SurfaceUvVectors2x3): SurfaceUvMatrix {
  const scaleU = Math.max(SURFACE_UV_MIN_SCALE, Math.hypot(matrix.u.x, matrix.u.y, matrix.u.z));
  const scaleV = Math.max(SURFACE_UV_MIN_SCALE, Math.hypot(matrix.v.x, matrix.v.y, matrix.v.z));
  const uDir = new THREE.Vector3(...vectors.uAxis);
  const vDir = new THREE.Vector3(...vectors.vAxis);
  if (
    uDir.lengthSq() <= 1e-12 ||
    vDir.lengthSq() <= 1e-12 ||
    new THREE.Vector3().crossVectors(uDir, vDir).lengthSq() <= 1e-12
  ) {
    return matrix.clone();
  }
  uDir.normalize();
  vDir.normalize();
  return new SurfaceUvMatrix(
    new THREE.Vector4(uDir.x * scaleU, uDir.y * scaleU, uDir.z * scaleU, matrix.u.w),
    new THREE.Vector4(vDir.x * scaleV, vDir.y * scaleV, vDir.z * scaleV, matrix.v.w),
  );
}

/**
 * Shifts a `SurfaceUvMatrix` by full-tile steps along U and/or V (`±1.0` per
 * tile).
 *
 * @param matrix Source UV matrix.
 * @param tilesU Tile steps to add to `u.w`.
 * @param tilesV Tile steps to add to `v.w`.
 * @returns Shifted UV matrix.
 */
export function surfaceUvFullTileShift(matrix: SurfaceUvMatrix, tilesU: number, tilesV: number): SurfaceUvMatrix {
  return new SurfaceUvMatrix(
    new THREE.Vector4(matrix.u.x, matrix.u.y, matrix.u.z, matrix.u.w + tilesU),
    new THREE.Vector4(matrix.v.x, matrix.v.y, matrix.v.z, matrix.v.w + tilesV),
  );
}

/**
 * Rounds an axis component to 4 decimal places for display stability.
 *
 * @param value Raw float component.
 * @returns Rounded value.
 */
function roundAxisComponent(value: number): number {
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
