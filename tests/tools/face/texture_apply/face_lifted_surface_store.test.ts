import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FaceLiftedSurfaceStore } from '@/tools/face/texture_apply/face_lifted_surface_store.js';
import { buildTargetsFromFaceSelection, initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';

/**
 * Builds a textured box in a world group and the region of its first face.
 *
 * @returns World, box and region.
 */
function liftedStoreTestRegionCreate(): {
  world: THREE.Group;
  mesh: THREE.Mesh;
  region: ReturnType<typeof buildTargetsFromFaceSelection>[number];
} {
  const world = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  world.add(mesh);
  mesh.updateMatrixWorld(true);
  initializeMeshTextureUVs(mesh, 'walls/start.png');
  const region = buildTargetsFromFaceSelection([{ mesh, faceIndex: 0 }])[0];
  if (!region) {
    throw new Error('region missing');
  }
  return { world, mesh, region };
}

describe('FaceLiftedSurfaceStore', () => {
  it('returns a copy of the lifted region while its mesh lives in the scene', () => {
    const { region } = liftedStoreTestRegionCreate();
    const store = new FaceLiftedSurfaceStore();
    expect(store.liftedTargetRead()).toBeNull();
    store.liftedTargetWrite(region);
    region.triangleIndices.push(9999);
    const lifted = store.liftedTargetRead();
    expect(lifted?.mesh).toBe(region.mesh);
    expect(lifted?.triangleIndices).not.toContain(9999);
    store.clear();
    expect(store.liftedTargetRead()).toBeNull();
  });

  it('forgets a lifted region whose mesh left the scene', () => {
    const { world, mesh, region } = liftedStoreTestRegionCreate();
    const store = new FaceLiftedSurfaceStore();
    store.liftedTargetWrite(region);
    world.remove(mesh);
    expect(store.liftedTargetRead()).toBeNull();
  });
});
