import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import {
  CommandSolidBrushesSnapVertices,
  type SnapVerticesStep,
} from '@/solid/commands/brushes/command_solid_brushes_snap_vertices.js';
import {
  solidBrushToolsTestBoxAdd,
  solidBrushToolsTestVertexKeys,
  solidBrushToolsTestWorldVertices,
} from '../../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/**
 * Pushes a snap command for one brush.
 *
 * @param model Owning model.
 * @param brush Brush to snap.
 * @param step Rounding mode.
 * @param interval Grid interval.
 * @param stack Undo stack.
 * @returns Executed command.
 */
function snapTestRun(
  model: SolidModel,
  brush: SolidBrushInstance,
  step: SnapVerticesStep,
  interval: number,
  stack: CommandStack,
): CommandSolidBrushesSnapVertices {
  const command = new CommandSolidBrushesSnapVertices([model], [brush], step, interval);
  stack.push(command);
  return command;
}

/**
 * Returns whether every world coordinate of a brush is a multiple of a step.
 *
 * @param brush Brush instance.
 * @param step Rounding step.
 * @returns True when every coordinate sits on the step.
 */
function snapTestOnStep(brush: SolidBrushInstance, step: number): boolean {
  return solidBrushToolsTestWorldVertices(brush).every((vertex) =>
    vertex.toArray().every((value) => Math.abs(value / step - Math.round(value / step)) < 1e-4),
  );
}

/**
 * Returns the texture id of the face whose normal points most along an axis.
 *
 * @param brush Brush instance.
 * @param axis Unit axis.
 * @returns Texture id of that face.
 */
function snapTestTextureAlong(brush: SolidBrushInstance, axis: THREE.Vector3): string | null {
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  brush.brush.planes.forEach((plane, index) => {
    const score = plane.normal.dot(axis);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return brush.getSurfaceTextureId(bestIndex);
}

describe('CommandSolidBrushesSnapVertices', () => {
  it('rounds every world vertex to the grid interval and keeps the brush valid', () => {
    const model = new SolidModel('SnapGrid');
    const interval = 0.5;
    const brush = solidBrushToolsTestBoxAdd(
      model,
      new THREE.Vector3(1.3, 2.1, 0.9),
      new THREE.Vector3(0.2, 0.1, -0.35),
    );
    expect(snapTestOnStep(brush, interval)).toBe(false);
    const command = snapTestRun(model, brush, 'grid', interval, new CommandStack(16));
    expect(command.getEditResult().edited).toHaveLength(1);
    expect(snapTestOnStep(brush, interval)).toBe(true);
    expect(SolidBrushValidator.validate(brush.brush).valid).toBe(true);
  });

  it('rounds to whole units with the integer step regardless of the grid', () => {
    const model = new SolidModel('SnapInteger');
    const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2.2, 1.8, 3.1), new THREE.Vector3(0.4, -0.3, 0.6));
    snapTestRun(model, brush, 'integer', 0.125, new CommandStack(16));
    expect(snapTestOnStep(brush, 1)).toBe(true);
  });

  it('keeps face textures on the faces that still point the same way', () => {
    const model = new SolidModel('SnapSurfaces');
    const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1.3, 1.3, 1.3), new THREE.Vector3(0.1, 0.1, 0.1));
    const up = new THREE.Vector3(0, 1, 0);
    const topIndex = brush.brush.planes.findIndex((plane) => plane.normal.dot(up) > 0.99);
    brush.setFaceTextureId(topIndex, 'snap-top-texture');
    snapTestRun(model, brush, 'grid', 0.5, new CommandStack(16));
    expect(snapTestTextureAlong(brush, up)).toBe('snap-top-texture');
  });

  it('undoes the snap back to the original vertices', () => {
    const model = new SolidModel('SnapUndo');
    const brush = solidBrushToolsTestBoxAdd(
      model,
      new THREE.Vector3(1.3, 2.1, 0.9),
      new THREE.Vector3(0.2, 0.1, -0.35),
    );
    const original = solidBrushToolsTestVertexKeys(brush);
    const stack = new CommandStack(16);
    snapTestRun(model, brush, 'grid', 0.5, stack);
    expect(solidBrushToolsTestVertexKeys(brush)).not.toEqual(original);
    stack.undo();
    expect(solidBrushToolsTestVertexKeys(model.findBrush(brush.id) ?? brush)).toEqual(original);
  });

  it('skips a brush that would collapse and leaves it unchanged', () => {
    const model = new SolidModel('SnapCollapse');
    const step = 1;
    const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(step / 5, step, step), new THREE.Vector3());
    const original = solidBrushToolsTestVertexKeys(brush);
    const command = snapTestRun(model, brush, 'integer', step, new CommandStack(16));
    expect(command.getEditResult().edited).toHaveLength(0);
    expect(command.getEditResult().skipped).toHaveLength(1);
    expect(solidBrushToolsTestVertexKeys(brush)).toEqual(original);
  });
});
