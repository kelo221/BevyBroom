import type * as THREE from 'three';
import {
  getSharedContentMaterials,
  meshUsesShadingOverrideMaterials,
} from '@/viewports/shared/shared_content_material_store.js';

/**
 * Returns the content materials of a mesh, looking past temporary viewport
 * shading overrides such as wireframe materials.
 *
 * @param mesh Live content mesh.
 * @returns The materials the mesh shows in normal shading.
 */
export function exportContentMaterialResolve(mesh: THREE.Mesh): THREE.Material | THREE.Material[] {
  if (!meshUsesShadingOverrideMaterials(mesh)) {
    return mesh.material;
  }
  return getSharedContentMaterials(mesh.uuid)?.materials ?? mesh.material;
}
