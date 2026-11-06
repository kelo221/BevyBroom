import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { createDefaultFaceTextureMapping, type FaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import { uvSmearFoldMappingBuild, type UvSmearFoldAnchor } from '@/texture/uv/uv_smear_transfer_fold.js';

/** Normal of the source plane. */
const SOURCE_NORMAL = new THREE.Vector3(0, 1, 0);

/** Normal of the destination plane, tilted away from the source. */
const DEST_NORMAL = new THREE.Vector3(0, 0.3, 1).normalize();

/**
 * Builds a source mapping with a rotated, scaled and shifted matrix on the
 * source plane.
 *
 * @returns Source mapping.
 */
function foldTestSourceMappingCreate(): FaceTextureMapping {
  const mapping = createDefaultFaceTextureMapping('walls/fold.png');
  mapping.uv = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0.37, -0.21), SOURCE_NORMAL, 23, 0.8, 1.3);
  return mapping;
}

/**
 * Builds an anchor on the line both planes share through a point, with the UVs
 * the source matrix shows there.
 *
 * @param sourceUv Source UV matrix.
 * @returns Shared edge anchor.
 */
function foldTestAnchorCreate(sourceUv: SurfaceUvMatrix): UvSmearFoldAnchor {
  const edgeDirection = new THREE.Vector3().crossVectors(SOURCE_NORMAL, DEST_NORMAL).normalize();
  const pointA = new THREE.Vector3(0.4, 0, -0.7).addScaledVector(SOURCE_NORMAL, 1);
  const pointB = pointA.clone().addScaledVector(edgeDirection, 2.5);
  return { pointA, pointB, uvA: sourceUv.project(pointA), uvB: sourceUv.project(pointB) };
}

describe('uvSmearFoldMappingBuild', () => {
  it('keeps the source UVs at both shared edge points on the destination plane', () => {
    const source = foldTestSourceMappingCreate();
    const anchor = foldTestAnchorCreate(source.uv);
    const folded = uvSmearFoldMappingBuild(source, SOURCE_NORMAL, DEST_NORMAL, anchor);
    expect(folded?.textureId).toBe('walls/fold.png');
    [
      [anchor.pointA, anchor.uvA],
      [anchor.pointB, anchor.uvB],
    ].forEach(([point, expected]) => {
      const projected = folded?.uv.project(point as THREE.Vector3);
      expect(projected?.u).toBeCloseTo((expected as { u: number }).u, 9);
      expect(projected?.v).toBeCloseTo((expected as { v: number }).v, 9);
    });
  });

  it('keeps the texel size of the source rows', () => {
    const source = foldTestSourceMappingCreate();
    const folded = uvSmearFoldMappingBuild(source, SOURCE_NORMAL, DEST_NORMAL, foldTestAnchorCreate(source.uv));
    const sourceLength = new THREE.Vector3(source.uv.u.x, source.uv.u.y, source.uv.u.z).length();
    const foldedLength = new THREE.Vector3(folded?.uv.u.x, folded?.uv.u.y, folded?.uv.u.z).length();
    expect(foldedLength).toBeCloseTo(sourceLength, 9);
  });

  it('declines parallel planes and source matrices that disagree with the mesh UVs', () => {
    const source = foldTestSourceMappingCreate();
    const anchor = foldTestAnchorCreate(source.uv);
    expect(uvSmearFoldMappingBuild(source, SOURCE_NORMAL, SOURCE_NORMAL, anchor)).toBeNull();
    const staleAnchor = { ...anchor, uvB: { u: anchor.uvB.u + 0.5, v: anchor.uvB.v } };
    expect(uvSmearFoldMappingBuild(source, SOURCE_NORMAL, DEST_NORMAL, staleAnchor)).toBeNull();
  });
});
