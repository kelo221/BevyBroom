import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { StatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { PolygonSketchFrame } from '@/tools/polygon/sketch/polygon_sketch_frame.js';
import type { PolygonExtrusionFrame } from '@/tools/polygon/polygon_convex_decomposer.js';
import type { PolygonSketchClientProjector } from '@/tools/polygon/sketch/polygon_sketch_projector.js';

/**
 * Builds a projector that maps client points one to one onto a fixed view
 * frame, honouring a locked frame when one is passed.
 *
 * @param viewFrame Frame chosen when no frame is locked.
 * @returns Projector and the spy recording its calls.
 */
function projectorFixedCreate(
  viewFrame: PolygonExtrusionFrame,
): ReturnType<typeof vi.fn<PolygonSketchClientProjector>> {
  return vi.fn<PolygonSketchClientProjector>((clientX, clientY, lockedFrame) => ({
    point: new THREE.Vector2(clientX, clientY),
    frame: lockedFrame ?? viewFrame,
  }));
}

/**
 * Builds the frame of a view looking along a direction.
 *
 * @param forward View direction.
 * @param up View up direction.
 * @returns Frame.
 */
function viewFrameCreate(forward: THREE.Vector3, up: THREE.Vector3): PolygonExtrusionFrame {
  return PolygonSketchFrame.fromView(forward, up, new THREE.Vector3(), 2);
}

describe('StatePolygonTool', () => {
  it('adopts the frame of the view the first point is placed in and locks it for later points', () => {
    const state = new StatePolygonTool();
    const frontFrame = viewFrameCreate(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
    const projector = projectorFixedCreate(frontFrame);
    state.clientPointProjectorWrite(projector);
    expect(state.placeVertexAtClientPoint(1, 2)).toBe(true);
    expect(state.previewFrameRead().axisNormal.equals(frontFrame.axisNormal)).toBe(true);
    expect(state.placeVertexAtClientPoint(3, 4)).toBe(true);
    expect(projector.mock.calls[0]?.[2]).toBeNull();
    expect(projector.mock.calls[1]?.[2]?.axisNormal.equals(frontFrame.axisNormal)).toBe(true);
    expect(state.verticesRead().map((vertex) => vertex.toArray())).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('reports a failed placement when the projector misses', () => {
    const state = new StatePolygonTool();
    state.clientPointProjectorWrite(() => null);
    expect(state.placeVertexAtClientPoint(5, 5)).toBe(false);
    expect(state.verticesRead()).toHaveLength(0);
    state.clientPointProjectorWrite(null);
    expect(state.placeVertexAtClientPoint(5, 5)).toBe(false);
  });

  it('follows the pointer cursor and previews in the frame under it before the first point', () => {
    const state = new StatePolygonTool();
    const sideFrame = viewFrameCreate(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
    state.clientPointProjectorWrite(projectorFixedCreate(sideFrame));
    const listener = vi.fn();
    state.changeListenerAdd(listener);
    state.cursorUpdateAtClientPoint(7, 8);
    expect(state.cursorPointRead()?.toArray()).toEqual([7, 8]);
    expect(state.previewFrameRead().axisNormal.equals(sideFrame.axisNormal)).toBe(true);
    state.cursorUpdateAtClientPoint(7, 8);
    expect(listener).toHaveBeenCalledTimes(1);
    state.cursorClear();
    expect(state.cursorPointRead()).toBeNull();
  });

  it('discards the outline and cursor when the tool is turned off so a new session starts empty', () => {
    const state = new StatePolygonTool();
    state.clientPointProjectorWrite(
      projectorFixedCreate(viewFrameCreate(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1))),
    );
    state.toolActiveWrite(true);
    state.placeVertexAtClientPoint(0, 0);
    state.placeVertexAtClientPoint(4, 0);
    state.cursorUpdateAtClientPoint(4, 4);
    state.toolActiveWrite(false);
    expect(state.verticesRead()).toHaveLength(0);
    expect(state.cursorPointRead()).toBeNull();
    state.toolActiveWrite(true);
    expect(state.verticesRead()).toHaveLength(0);
  });
});
