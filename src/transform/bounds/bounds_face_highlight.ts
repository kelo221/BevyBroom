import * as THREE from 'three';
import { BoundsFace, BOUNDS_FACE_USERDATA_KEY } from '@/types/bounds_face.js';
import { Theme } from '@/theme.js';

/** UserData key for the bounds face edge-outline highlight object. */
export const BOUNDS_FACE_EDGE_HIGHLIGHT_KEY = 'isBoundsFaceEdgeHighlight';

/**
 * Applies or clears the selection-orange edge-outline highlight for a bounds
 * face on every edge highlight object under the root.
 *
 * @param root Gizmo root (master or viewport gizmo clone).
 * @param highlightedFace Face to outline, or null to clear.
 * @param theme Theme colors.
 */
export function applyBoundsFaceEdgeHighlight(
  root: THREE.Object3D,
  highlightedFace: BoundsFace | null,
  theme: typeof Theme = Theme,
): void {
  root.traverse((child) => {
    if (child.userData[BOUNDS_FACE_EDGE_HIGHLIGHT_KEY] !== true) return;
    const face = child.userData[BOUNDS_FACE_USERDATA_KEY] as BoundsFace | undefined;
    child.visible = highlightedFace !== null && face === highlightedFace;
    if (!child.visible || !(child instanceof THREE.LineSegments)) return;
    const material = child.material;
    if (!Array.isArray(material) && material instanceof THREE.LineBasicMaterial) {
      material.color.setHex(theme.selectionColor);
      material.needsUpdate = true;
    }
  });
}

/**
 * Builds a unit face perimeter (local Z = 0, extent ±1 on X/Y) for edge
 * highlight meshes that are later scaled to the OBB face size.
 *
 * @returns Buffer geometry for four line segments around a unit square.
 */
export function createUnitFaceEdgeHighlightGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 1, -1, 0, 1, 1, 0, 1, 1, 0, -1, 1, 0, -1, 1, 0, -1, -1, 0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
