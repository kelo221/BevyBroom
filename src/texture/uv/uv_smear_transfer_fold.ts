import * as THREE from 'three';
import { type FaceTextureMapping, withTrsAccessors } from './face_texture_mapping.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';

/**
 * Largest UV difference at which the source matrix still agrees with the source
 * mesh UVs.
 */
const UV_SMEAR_FOLD_SOURCE_AGREEMENT_TOLERANCE = 1e-4;

/**
 * Smallest |source normal × destination normal|² that still defines a fold
 * axis.
 */
const UV_SMEAR_FOLD_PARALLEL_DET = 1e-8;

/** Shared edge samples a fold is anchored to. */
export interface UvSmearFoldAnchor {
  /** First shared edge point in world space. */
  readonly pointA: THREE.Vector3;
  /** Second shared edge point in world space. */
  readonly pointB: THREE.Vector3;
  /** Source UV the mesh shows at the first point. */
  readonly uvA: { u: number; v: number };
  /** Source UV the mesh shows at the second point. */
  readonly uvB: { u: number; v: number };
}

/**
 * Builds the destination mapping by folding the source UV matrix around the
 * shared edge onto the destination plane, so both shared edge points keep the
 * exact source UVs. Returns null when the faces are parallel or the source
 * matrix disagrees with the UVs the source mesh shows on the edge.
 *
 * @param sourceMapping Mapping of the source face.
 * @param sourceNormal World normal of the source face.
 * @param destNormal World normal of the destination face.
 * @param anchor Shared edge points and the source UVs shown at them.
 * @returns Folded destination mapping, or null when no exact fold applies.
 */
export function uvSmearFoldMappingBuild(
  sourceMapping: FaceTextureMapping,
  sourceNormal: THREE.Vector3,
  destNormal: THREE.Vector3,
  anchor: UvSmearFoldAnchor,
): FaceTextureMapping | null {
  if (new THREE.Vector3().crossVectors(sourceNormal, destNormal).lengthSq() < UV_SMEAR_FOLD_PARALLEL_DET) {
    return null;
  }
  if (!uvSmearFoldSourceAgreesWithMesh(sourceMapping.uv, anchor)) {
    return null;
  }
  const fold = new THREE.Quaternion().setFromUnitVectors(
    sourceNormal.clone().normalize(),
    destNormal.clone().normalize(),
  );
  const uRow = uvSmearFoldRowRotate(sourceMapping.uv.u, fold, anchor.pointA, anchor.uvA.u);
  const vRow = uvSmearFoldRowRotate(sourceMapping.uv.v, fold, anchor.pointA, anchor.uvA.v);
  return withTrsAccessors({ textureId: sourceMapping.textureId, uv: new SurfaceUvMatrix(uRow, vRow), align: 'face' });
}

/**
 * Returns whether the source matrix projects both shared edge points to the UVs
 * the source mesh shows there.
 *
 * @param sourceUv Source UV matrix.
 * @param anchor Shared edge points and the source UVs shown at them.
 * @returns True when the matrix matches the mesh UVs on the edge.
 */
function uvSmearFoldSourceAgreesWithMesh(sourceUv: SurfaceUvMatrix, anchor: UvSmearFoldAnchor): boolean {
  return (
    uvSmearFoldUvDistance(sourceUv.project(anchor.pointA), anchor.uvA) < UV_SMEAR_FOLD_SOURCE_AGREEMENT_TOLERANCE &&
    uvSmearFoldUvDistance(sourceUv.project(anchor.pointB), anchor.uvB) < UV_SMEAR_FOLD_SOURCE_AGREEMENT_TOLERANCE
  );
}

/**
 * Measures the larger per-axis difference of two UV pairs.
 *
 * @param first First UV pair.
 * @param second Second UV pair.
 * @returns Largest absolute axis difference.
 */
function uvSmearFoldUvDistance(first: { u: number; v: number }, second: { u: number; v: number }): number {
  return Math.max(Math.abs(first.u - second.u), Math.abs(first.v - second.v));
}

/**
 * Rotates one UV row by the fold and re-anchors its offset so the anchor point
 * keeps its UV value.
 *
 * @param row Source UV row (xyz axis, w offset).
 * @param fold Rotation taking the source plane onto the destination plane.
 * @param anchorPoint World point on the fold axis.
 * @param anchorValue UV value the anchor point must keep.
 * @returns Folded UV row.
 */
function uvSmearFoldRowRotate(
  row: THREE.Vector4,
  fold: THREE.Quaternion,
  anchorPoint: THREE.Vector3,
  anchorValue: number,
): THREE.Vector4 {
  const axis = new THREE.Vector3(row.x, row.y, row.z).applyQuaternion(fold);
  return new THREE.Vector4(axis.x, axis.y, axis.z, anchorValue - axis.dot(anchorPoint));
}
