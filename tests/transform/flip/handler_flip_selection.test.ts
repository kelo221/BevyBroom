import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import type { FlipAxis } from '@/transform/flip/flip_axis.js';
import { HandlerFlipSelection, type FlipSelectionResult } from '@/transform/flip/handler_flip_selection.js';
import {
  solidBrushToolsTestBoxAdd,
  solidBrushToolsTestMeshes,
  solidBrushToolsTestVertexKeys,
  solidBrushToolsTestWorldBounds,
} from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** Two boxes whose bounds center sits off the grid. */
interface FlipTestScene {
  readonly model: SolidModel;
  readonly brushes: SolidBrushInstance[];
}

/**
 * Builds two boxes of different sizes so the selection is asymmetric.
 *
 * @returns Model and brushes.
 */
function flipTestSceneCreate(): FlipTestScene {
  const model = new SolidModel('Flip');
  const first = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2, 1, 1), new THREE.Vector3(0.25, 0, 0));
  const second = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1, 3, 2), new THREE.Vector3(3, 1.5, 1));
  return { model, brushes: [first, second] };
}

/**
 * Flips the scene brushes across one axis.
 *
 * @param brushes Selected brushes.
 * @param axis Mirror axis.
 * @param stack Undo stack receiving the flip.
 * @param gridSnap Grid snap used for the mirror center.
 * @returns Flip result.
 */
function flipTestRun(
  brushes: readonly SolidBrushInstance[],
  axis: FlipAxis,
  stack: CommandStack,
  gridSnap: GridSnap | null,
): FlipSelectionResult | null {
  return new HandlerFlipSelection({
    commandStack: stack,
    getSelectedObjects: () => solidBrushToolsTestMeshes(brushes),
    gridSnap,
    isTexturePositionLockEnabled: () => true,
    showStatusMessage: () => undefined,
  }).flip(axis);
}

/**
 * Mirrors one box across a plane perpendicular to an axis.
 *
 * @param bounds Box to mirror.
 * @param axis Mirror axis.
 * @param center Plane coordinate.
 * @returns Mirrored box.
 */
function flipTestBoundsMirror(bounds: THREE.Box3, axis: FlipAxis, center: number): THREE.Box3 {
  const mirrored = bounds.clone();
  mirrored.min[axis] = 2 * center - bounds.max[axis];
  mirrored.max[axis] = 2 * center - bounds.min[axis];
  return mirrored;
}

/**
 * Returns the vertex keys of every brush.
 *
 * @param brushes Brushes.
 * @returns Vertex keys per brush.
 */
function flipTestKeys(brushes: readonly SolidBrushInstance[]): string[][] {
  return brushes.map((brush) => solidBrushToolsTestVertexKeys(brush));
}

describe('HandlerFlipSelection', () => {
  it('mirrors the selection across the grid-snapped center of its bounds', () => {
    const { brushes } = flipTestSceneCreate();
    const gridSnap = new GridSnap(true, 1);
    const before = solidBrushToolsTestWorldBounds(brushes);
    const rawCenter = (before.min.x + before.max.x) / 2;
    const result = flipTestRun(brushes, 'x', new CommandStack(16), gridSnap);
    expect(result?.flipped).toHaveLength(brushes.length);
    expect(result?.center).toBeCloseTo(gridSnap.snapValue(rawCenter), 6);
    const expected = flipTestBoundsMirror(before, 'x', result?.center ?? rawCenter);
    const after = solidBrushToolsTestWorldBounds(brushes);
    expect(after.min.distanceTo(expected.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(expected.max)).toBeLessThan(1e-4);
  });

  it('keeps the raw bounds center without grid snapping', () => {
    const { brushes } = flipTestSceneCreate();
    const before = solidBrushToolsTestWorldBounds(brushes);
    const result = flipTestRun(brushes, 'y', new CommandStack(16), null);
    expect(result?.center).toBeCloseTo((before.min.y + before.max.y) / 2, 6);
    const after = solidBrushToolsTestWorldBounds(brushes);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
  });

  it('returns every vertex to its place after flipping twice on the same axis', () => {
    const { brushes } = flipTestSceneCreate();
    const original = flipTestKeys(brushes);
    const stack = new CommandStack(16);
    flipTestRun(brushes, 'z', stack, null);
    expect(flipTestKeys(brushes)).not.toEqual(original);
    flipTestRun(brushes, 'z', stack, null);
    expect(flipTestKeys(brushes)).toEqual(original);
  });

  it('undoes a flip in one step', () => {
    const { brushes } = flipTestSceneCreate();
    const original = flipTestKeys(brushes);
    const stack = new CommandStack(16);
    flipTestRun(brushes, 'x', stack, new GridSnap(true, 1));
    stack.undo();
    expect(flipTestKeys(brushes)).toEqual(original);
  });

  it('reports an empty selection without an undo entry', () => {
    const stack = new CommandStack(16);
    expect(flipTestRun([], 'x', stack, null)).toBeNull();
    expect(stack.canUndo()).toBe(false);
  });
});
