import type * as THREE from 'three';
import { entityOwnerIs, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { SELECTION_HIGHLIGHT_USERDATA_KEY } from '@/selection/object/selection_highlight.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { DECORATIVE_EDGE_USERDATA_KEY, isSolidBrushEdge } from '@/utils/mesh_edge_sync.js';

/**
 * Returns whether an object is editor-internal and must not appear in exports.
 *
 * @param object Candidate object.
 * @returns True when the object should be omitted.
 */
export function shouldOmitFromExport(object: THREE.Object3D): boolean {
  if (SolidBrushVisual.isBrushObject(object)) return true;
  if (isSolidBrushEdge(object)) return true;
  if (object.userData[DECORATIVE_EDGE_USERDATA_KEY] === true) return true;
  if (object.userData[SELECTION_HIGHLIGHT_USERDATA_KEY] === true) return true;
  if (object.userData['isSelectionHighlight'] === true) return true;
  if (object.userData['isWireframeOverlay'] === true) return true;
  if (object.userData['isFaceSelectionHighlight'] === true) return true;
  if (object.userData['isClipPlanePreview'] === true) return true;
  if (object.userData['isBoundsGuideLines'] === true) return true;
  if (object.userData['isGizmoOccludedGhost'] === true) return true;
  if (object.userData['isCadRuler'] === true) return true;
  if (object.userData['isSolidBrushPreview'] === true) return true;
  if (object.userData['isModifierVolume'] === true) return true;
  if (object.userData['isModifierVolumeEdge'] === true) return true;
  if (entityOwnerIs(object) || entityVisualPartIs(object)) return true;
  return false;
}
