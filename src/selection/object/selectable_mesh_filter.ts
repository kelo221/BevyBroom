import * as THREE from 'three';
import { SELECTION_HIGHLIGHT_USERDATA_KEY } from '@/selection/object/selection_highlight.js';
import { CLIP_PREVIEW_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview.js';
import { objectInUnselectableLayerIs } from '@/layer/model/layer_membership.js';

/**
 * Returns whether a mesh is an editor overlay or helper rather than content the
 * user can select.
 *
 * @param mesh The object to test.
 * @returns True when the object is classified as a helper.
 */
export function selectableMeshHelperIs(mesh: THREE.Object3D): boolean {
  if (mesh.userData[SELECTION_HIGHLIGHT_USERDATA_KEY] === true) return true;
  if (mesh.userData[CLIP_PREVIEW_USERDATA_KEY] === true) return true;
  if (mesh.userData['isWireframeOverlay'] === true) return true;
  if (mesh.userData['isSelectionHighlight']) return true;
  if (mesh.userData['isSolidModelResult'] === true) return true;
  if (mesh instanceof THREE.LineSegments && mesh.parent instanceof THREE.Mesh) {
    return true;
  }
  return selectableMeshUnderClipPreviewIs(mesh);
}

/**
 * Returns whether an object sits under the clip plane preview.
 *
 * @param object The object to test.
 * @returns True when an ancestor is the clip plane preview.
 */
function selectableMeshUnderClipPreviewIs(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object.parent;
  while (current) {
    if (current.userData[CLIP_PREVIEW_USERDATA_KEY] === true) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Collects the meshes under a world root the user can select: content meshes
 * outside hidden and locked layers.
 *
 * @param worldObject World root.
 * @returns Selectable meshes in scene order.
 */
export function selectableMeshesCollect(worldObject: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (const topLevelObject of worldObject.children) {
    if (objectInUnselectableLayerIs(topLevelObject)) {
      continue;
    }
    topLevelObject.traverse((child) => {
      if (child instanceof THREE.Mesh && !selectableMeshHelperIs(child)) {
        meshes.push(child);
      }
    });
  }
  return meshes;
}
