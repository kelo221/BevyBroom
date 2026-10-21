import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { BoundsFace } from '@/types/bounds_face.js';
import {
  applyBoundsFaceEdgeHighlight,
  BOUNDS_FACE_EDGE_HIGHLIGHT_KEY,
  createUnitFaceEdgeHighlightGeometry,
} from '@/transform/bounds/bounds_face_highlight.js';

describe('bounds face edge highlight', () => {
  it('builds a unit square perimeter geometry with eight endpoints', () => {
    const geometry = createUnitFaceEdgeHighlightGeometry();
    const positions = geometry.getAttribute('position');
    expect(positions).toBeTruthy();
    expect(positions!.count).toBe(8);
    geometry.dispose();
  });

  it('shows only the highlighted face edge outline in the selection color', () => {
    const root = new THREE.Group();
    const a = createEdgeHighlight(BoundsFace.POS_X);
    const b = createEdgeHighlight(BoundsFace.POS_Y);
    root.add(a, b);

    applyBoundsFaceEdgeHighlight(root, BoundsFace.POS_X);

    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
    expect((a.material as THREE.LineBasicMaterial).color.getHex()).toBe(Theme.selectionColor);
  });

  it('colors the outline with the selection color of the given theme', () => {
    const root = new THREE.Group();
    const edge = createEdgeHighlight(BoundsFace.POS_Z);
    root.add(edge);
    const customSelectionColor = (Theme.selectionColor ^ 0x00ff00) & 0xffffff;
    const customTheme = { ...Theme, selectionColor: customSelectionColor } as unknown as typeof Theme;

    applyBoundsFaceEdgeHighlight(root, BoundsFace.POS_Z, customTheme);

    expect(edge.visible).toBe(true);
    expect((edge.material as THREE.LineBasicMaterial).color.getHex()).toBe(customSelectionColor);
  });

  it('hides all edge outlines when highlight is cleared', () => {
    const root = new THREE.Group();
    const edge = createEdgeHighlight(BoundsFace.NEG_Z);
    root.add(edge);
    applyBoundsFaceEdgeHighlight(root, BoundsFace.NEG_Z);
    applyBoundsFaceEdgeHighlight(root, null);
    expect(edge.visible).toBe(false);
  });
});

/**
 * Builds a minimal edge-highlight object for tests.
 *
 * @param face Bounds face stored in userData.
 * @returns LineSegments stand-in.
 */
function createEdgeHighlight(face: BoundsFace): THREE.LineSegments {
  const lines = new THREE.LineSegments(
    createUnitFaceEdgeHighlightGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  lines.userData[BOUNDS_FACE_EDGE_HIGHLIGHT_KEY] = true;
  lines.userData['boundsFace'] = face;
  lines.visible = false;
  return lines;
}
