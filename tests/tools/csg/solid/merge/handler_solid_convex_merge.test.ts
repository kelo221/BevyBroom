import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { HandlerSolidConvexMerge } from '@/tools/csg/solid/merge/handler_solid_convex_merge.js';
import {
  solidBrushToolsTestBoundsMatch,
  solidBrushToolsTestBoxAdd,
  solidBrushToolsTestWorldBounds,
  solidBrushToolsTestWorldVertices,
} from '../solid_brush_tools_test_helpers.js';

/** Two separated boxes in one model. */
interface ConvexMergeTestScene {
  readonly model: SolidModel;
  readonly lower: SolidBrushInstance;
  readonly upper: SolidBrushInstance;
}

/**
 * Builds two boxes of different sizes, one above and beside the other.
 *
 * @returns Model with both boxes.
 */
function convexMergeTestSceneCreate(): ConvexMergeTestScene {
  const model = new SolidModel('ConvexMerge');
  const lower = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2, 1, 2), new THREE.Vector3(-1, 0, 0));
  const upper = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1, 1, 1), new THREE.Vector3(3, 2, 1));
  return { model, lower, upper };
}

/**
 * Returns the face whose outward normal points most along an axis.
 *
 * @param brush Brush instance.
 * @param axis Unit axis in world space.
 * @returns Face index.
 */
function convexMergeTestFaceAlong(brush: SolidBrushInstance, axis: THREE.Vector3): number {
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  brush.getModelSpaceBrush().planes.forEach((plane, index) => {
    const score = plane.normal.dot(axis);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Returns the world bounds of one face of a brush.
 *
 * @param brush Brush instance.
 * @param faceIndex Face index.
 * @returns World bounds of the face corners.
 */
function convexMergeTestFaceBounds(brush: SolidBrushInstance, faceIndex: number): THREE.Box3 {
  const modelBrush = brush.getModelSpaceBrush();
  const face = modelBrush.faces[faceIndex];
  const bounds = new THREE.Box3();
  if (face) {
    modelBrush.getFaceVertices(face).forEach((vertex) => bounds.expandByPoint(vertex));
  }
  return bounds;
}

describe('HandlerSolidConvexMerge', () => {
  it('replaces selected brushes with one valid brush spanning their bounds', () => {
    const { model, lower, upper } = convexMergeTestSceneCreate();
    const expectedBounds = solidBrushToolsTestWorldBounds([lower, upper]);
    const before = model.getBrushes().length;
    const created = new HandlerSolidConvexMerge(new CommandStack(16), () => undefined).mergeBrushes([lower, upper]);
    expect(created).not.toBeNull();
    if (!created) return;
    expect(SolidBrushValidator.validate(created.brush).valid).toBe(true);
    expect(solidBrushToolsTestBoundsMatch(solidBrushToolsTestWorldBounds([created]), expectedBounds)).toBe(true);
    expect(model.getBrushes().length).toBe(before - 1);
    expect(model.findBrush(lower.id)).toBeUndefined();
    expect(model.findBrush(upper.id)).toBeUndefined();
  });

  it('keeps every source corner inside or on the merged brush', () => {
    const { lower, upper } = convexMergeTestSceneCreate();
    const corners = [...solidBrushToolsTestWorldVertices(lower), ...solidBrushToolsTestWorldVertices(upper)];
    const created = new HandlerSolidConvexMerge(new CommandStack(16), () => undefined).mergeBrushes([lower, upper]);
    expect(created).not.toBeNull();
    if (!created) return;
    const planes = created.getModelSpaceBrush().planes;
    for (const corner of corners) {
      expect(Math.max(...planes.map((plane) => plane.signedDistance(corner)))).toBeLessThanOrEqual(1e-4);
    }
  });

  it('undoes the merge back to the original brushes in one step', () => {
    const { model, lower, upper } = convexMergeTestSceneCreate();
    const stack = new CommandStack(16);
    const before = model.getBrushes().length;
    new HandlerSolidConvexMerge(stack, () => undefined).mergeBrushes([lower, upper]);
    stack.undo();
    expect(model.getBrushes().length).toBe(before);
    expect(model.findBrush(lower.id)).toBeDefined();
    expect(model.findBrush(upper.id)).toBeDefined();
    stack.redo();
    expect(model.getBrushes().length).toBe(before - 1);
  });

  it('builds a brush around selected faces and keeps the source brushes', () => {
    const { model, lower, upper } = convexMergeTestSceneCreate();
    const lowerTop = convexMergeTestFaceAlong(lower, new THREE.Vector3(0, 1, 0));
    const upperTop = convexMergeTestFaceAlong(upper, new THREE.Vector3(0, 1, 0));
    const expectedBounds = convexMergeTestFaceBounds(lower, lowerTop).union(convexMergeTestFaceBounds(upper, upperTop));
    const before = model.getBrushes().length;
    const created = new HandlerSolidConvexMerge(new CommandStack(16), () => undefined).mergeFaces([
      { instance: lower, faceIndex: lowerTop },
      { instance: upper, faceIndex: upperTop },
    ]);
    expect(created).not.toBeNull();
    if (!created) return;
    expect(model.getBrushes().length).toBe(before + 1);
    expect(solidBrushToolsTestBoundsMatch(solidBrushToolsTestWorldBounds([created]), expectedBounds)).toBe(true);
  });

  it('refuses a single brush and reports why', () => {
    const { lower } = convexMergeTestSceneCreate();
    const messages: string[] = [];
    const stack = new CommandStack(16);
    const created = new HandlerSolidConvexMerge(stack, (message) => messages.push(message)).mergeBrushes([lower]);
    expect(created).toBeNull();
    expect(messages.at(-1)).toContain('two or more');
    expect(stack.canUndo()).toBe(false);
  });
});
