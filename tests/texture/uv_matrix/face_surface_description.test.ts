import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { reorientFaceSurface } from '@/texture/uv_matrix/face_surface_description.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';

/** Proves surfaces move between face normals without losing their layout. */
describe('reorientFaceSurface', () => {
  it('keeps texture, offset, rotation and scale while projecting along the new normal', () => {
    const sourceNormal = new THREE.Vector3(1, 0, 0);
    const destinationNormal = new THREE.Vector3(1, 0, 1).normalize();
    const surface = {
      textureId: 'reorient.png',
      uv: SurfaceUvMatrix.fromTrs(new THREE.Vector2(0.25, -0.5), sourceNormal, 30, 0.5, 2),
    };
    const reoriented = reorientFaceSurface(surface, sourceNormal, destinationNormal);
    const sourceTrs = surface.uv.decompose(sourceNormal);
    const destinationTrs = reoriented.uv.decompose(destinationNormal);
    expect(reoriented.textureId).toBe('reorient.png');
    expect(destinationTrs.translation.distanceTo(sourceTrs.translation)).toBeLessThan(1e-6);
    expect(destinationTrs.rotationDeg).toBeCloseTo(sourceTrs.rotationDeg, 5);
    expect(destinationTrs.scaleU).toBeCloseTo(sourceTrs.scaleU, 5);
    expect(destinationTrs.scaleV).toBeCloseTo(sourceTrs.scaleV, 5);
    expect(reoriented.uv.planeNormalAlignedTo(destinationNormal).dot(destinationNormal)).toBeCloseTo(1, 5);
  });
});
