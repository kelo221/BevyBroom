import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  PolygonOutlinePreview,
  POLYGON_OUTLINE_PREVIEW_USERDATA_KEY,
} from '@/tools/polygon/preview/polygon_outline_preview.js';
import { StatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import type { ShapeDrawPreviewHost } from '@/tools/shape_draw/shape_draw_preview.js';
import { Theme } from '@/theme.js';

/**
 * Builds a helper host backed by a scene.
 *
 * @returns Scene receiving helpers and the host adding to it.
 */
function helperHostCreate(): { scene: THREE.Scene; host: ShapeDrawPreviewHost } {
  const scene = new THREE.Scene();
  return {
    scene,
    host: {
      addHelper: (object) => scene.add(object),
      removeHelper: (object) => scene.remove(object),
    },
  };
}

/**
 * Returns how many vertices a named preview part draws.
 *
 * @param root Preview root.
 * @param name Part name.
 * @returns Vertex count, or -1 when the part is missing.
 */
function partVertexCountRead(root: THREE.Object3D, name: string): number {
  const part = root.getObjectByName(name);
  if (!(part instanceof THREE.LineSegments) && !(part instanceof THREE.Points)) {
    return -1;
  }
  return part.geometry.drawRange.count;
}

/**
 * Builds a Polygon state whose projector maps client points one to one onto its
 * default frame.
 *
 * @returns State.
 */
function stateWithIdentityProjectorCreate(): StatePolygonTool {
  const state = new StatePolygonTool();
  state.clientPointProjectorWrite((clientX, clientY, lockedFrame) => ({
    point: new THREE.Vector2(clientX, clientY),
    frame: lockedFrame ?? state.previewFrameRead(),
  }));
  return state;
}

describe('PolygonOutlinePreview', () => {
  it('lives in the helper scene, marked editor-only, and shows only while the tool is active', () => {
    const { scene, host } = helperHostCreate();
    const state = stateWithIdentityProjectorCreate();
    const preview = new PolygonOutlinePreview(host, state);
    const root = preview.previewObject();
    expect(root.parent).toBe(scene);
    expect(root.userData[POLYGON_OUTLINE_PREVIEW_USERDATA_KEY]).toBe(true);
    expect(root.visible).toBe(false);
    state.toolActiveWrite(true);
    expect(root.visible).toBe(true);
    state.toolActiveWrite(false);
    expect(root.visible).toBe(false);
    preview.dispose();
  });

  it('rebuilds points, edges and the rubber band as the outline and cursor change', () => {
    const { host } = helperHostCreate();
    const state = stateWithIdentityProjectorCreate();
    const preview = new PolygonOutlinePreview(host, state);
    const root = preview.previewObject();
    state.toolActiveWrite(true);
    state.placeVertexAtClientPoint(0, 0);
    state.placeVertexAtClientPoint(3, 0);
    state.cursorUpdateAtClientPoint(3, 3);
    expect(partVertexCountRead(root, 'polygon_outline_preview_points')).toBe(3);
    expect(partVertexCountRead(root, 'polygon_outline_preview_edges')).toBe(2);
    expect(partVertexCountRead(root, 'polygon_outline_preview_rubber_band')).toBe(4);
    state.vertexRemoveLast();
    expect(partVertexCountRead(root, 'polygon_outline_preview_edges')).toBe(0);
    preview.dispose();
  });

  it('draws in theme colours and leaves the scene on dispose', () => {
    const { scene, host } = helperHostCreate();
    const preview = new PolygonOutlinePreview(host, new StatePolygonTool());
    const edges = preview.previewObject().getObjectByName('polygon_outline_preview_edges');
    const material = edges instanceof THREE.LineSegments ? edges.material : null;
    expect(material instanceof THREE.LineBasicMaterial ? material.color.getHex() : -1).toBe(Theme.polygonOutlineColor);
    preview.dispose();
    expect(preview.previewObject().parent).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it('reuses its buffers while the cursor moves and grows them without leaking for long outlines', () => {
    const { host } = helperHostCreate();
    const state = stateWithIdentityProjectorCreate();
    const preview = new PolygonOutlinePreview(host, state);
    const points = preview.previewObject().getObjectByName('polygon_outline_preview_points');
    expect(points).toBeInstanceOf(THREE.Points);
    if (!(points instanceof THREE.Points)) return;
    state.toolActiveWrite(true);
    state.placeVertexAtClientPoint(0, 0);
    const geometryBeforeMoves = points.geometry;
    const attributeBeforeMoves = geometryBeforeMoves.getAttribute('position');
    for (let step = 1; step <= 20; step += 1) state.cursorUpdateAtClientPoint(step, step * 2);
    expect(points.geometry).toBe(geometryBeforeMoves);
    expect(points.geometry.getAttribute('position')).toBe(attributeBeforeMoves);
    const capacity = attributeBeforeMoves.count;
    const dispose = vi.spyOn(geometryBeforeMoves, 'dispose');
    for (let index = 1; index <= capacity; index += 1) state.placeVertexAtClientPoint(index, 0);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(partVertexCountRead(preview.previewObject(), 'polygon_outline_preview_points')).toBe(capacity + 2);
    preview.dispose();
  });
});
