import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildBrushEditCage, type BrushEditCage } from '@/edit/brush/brush_edit_cage.js';
import { ComponentEditCageOverlay } from '@/edit/component/component_edit_cage_overlay.js';
import { buildComponentHandleDrawBuffers } from '@/edit/component/component_edit_handle_points.js';
import { EDIT_CAGE_COLOR, EDIT_SELECTED_VERTEX_COLOR } from '@/edit/component/component_edit_selection_draw.js';
import { buildComponentEdgeKey } from '@/edit/component/component_selection_entry.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { EditorComponentMode } from '@/types/editor_component_mode.js';

/**
 * Builds the edit cage of a fresh box brush.
 *
 * @returns Cage.
 */
function boxCageCreate(): BrushEditCage {
  const model = new SolidModel('Handles');
  const instance = model.addBoxBrush(2, SolidOperation.Additive);
  model.root.updateMatrixWorld(true);
  return buildBrushEditCage(model, instance, instance.id);
}

/**
 * Reads the handle color at an index.
 *
 * @param colors Flat rgb list.
 * @param index Handle index.
 * @returns Color.
 */
function handleColorRead(colors: readonly number[], index: number): THREE.Color {
  return new THREE.Color(colors[index * 3] ?? 0, colors[index * 3 + 1] ?? 0, colors[index * 3 + 2] ?? 0);
}

/** Proves Edge and Face mode get grab handles at edge middles and face centers. */
describe('buildComponentHandleDrawBuffers', () => {
  it('puts one handle at the middle of every edge in Edge mode', () => {
    const cage = boxCageCreate();
    const buffers = buildComponentHandleDrawBuffers([], [cage], [], EditorComponentMode.EDGE);
    expect(buffers.coords.length / 3).toBe(cage.edges.length);
    const first = cage.edges[0];
    const middle = (cage.worldPositions[first?.vertexA ?? 0] as THREE.Vector3)
      .clone()
      .add(cage.worldPositions[first?.vertexB ?? 0] as THREE.Vector3)
      .multiplyScalar(0.5);
    expect(new THREE.Vector3(buffers.coords[0], buffers.coords[1], buffers.coords[2]).distanceTo(middle)).toBeLessThan(
      1e-9,
    );
  });

  it('puts one handle at the center of every face in Face mode', () => {
    const cage = boxCageCreate();
    const buffers = buildComponentHandleDrawBuffers([], [cage], [], EditorComponentMode.FACE);
    expect(buffers.coords.length / 3).toBe(cage.faces.length);
  });

  it('draws no extra handles in Vertex mode', () => {
    const buffers = buildComponentHandleDrawBuffers([], [boxCageCreate()], [], EditorComponentMode.VERTEX);
    expect(buffers.coords).toEqual([]);
  });

  it('highlights the handle of a selected edge only', () => {
    const cage = boxCageCreate();
    const edge = cage.edges[1];
    const key = buildComponentEdgeKey(edge?.vertexA ?? 0, edge?.vertexB ?? 0);
    const selected = [{ targetId: cage.targetId, kind: 'edge' as const, componentKey: key }];
    const buffers = buildComponentHandleDrawBuffers([], [cage], selected, EditorComponentMode.EDGE);
    expect(handleColorRead(buffers.colors, 1).equals(new THREE.Color(EDIT_SELECTED_VERTEX_COLOR))).toBe(true);
    expect(handleColorRead(buffers.colors, 0).equals(new THREE.Color(EDIT_CAGE_COLOR))).toBe(true);
  });
});

/**
 * Proves the cage shows vertex dots in Vertex mode and the handles in the other
 * modes.
 */
describe('ComponentEditCageOverlay handles', () => {
  it('swaps vertex dots for handles when the mode leaves Vertex', () => {
    const overlay = new ComponentEditCageOverlay(new THREE.Scene());
    const cage = boxCageCreate();
    overlay.update([], [cage], [], EditorComponentMode.VERTEX);
    expect(overlay.getVertexPoints().visible).toBe(true);
    expect(overlay.getHandlePoints().visible).toBe(false);
    overlay.update([], [cage], [], EditorComponentMode.FACE);
    expect(overlay.getVertexPoints().visible).toBe(false);
    expect(overlay.getHandlePoints().visible).toBe(true);
    overlay.dispose();
  });
});
