import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { HandlerSolidHollow } from '@/tools/csg/solid/hollow/handler_solid_hollow.js';
import {
  SOLID_BRUSH_TOOLS_TEST_EPSILON,
  solidBrushToolsTestBoundsMatch,
  solidBrushToolsTestBoxAdd,
  solidBrushToolsTestMeshes,
  solidBrushToolsTestWorldBounds,
} from '../solid_brush_tools_test_helpers.js';

/** Hollow run outcome with the services it used. */
interface HollowTestRun {
  readonly created: THREE.Mesh[] | null;
  readonly stack: CommandStack;
  readonly messages: string[];
}

/**
 * Runs the hollow action on a selection.
 *
 * @param selected Selected objects.
 * @param thickness Wall thickness.
 * @returns Created walls, undo stack and status messages.
 */
function hollowTestRun(selected: readonly THREE.Object3D[], thickness: number): HollowTestRun {
  const stack = new CommandStack(16);
  const messages: string[] = [];
  const created = new HandlerSolidHollow({
    commandStack: stack,
    getSelectedObjects: () => selected,
    thicknessRead: () => thickness,
    showStatusMessage: (message: string) => messages.push(message),
  }).run();
  return { created, stack, messages };
}

/**
 * Resolves the brush instances of created wall meshes.
 *
 * @param model Model owning the walls.
 * @param meshes Wall meshes.
 * @returns Wall brush instances.
 */
function hollowTestWallBrushes(model: SolidModel, meshes: readonly THREE.Mesh[]): SolidBrushInstance[] {
  return meshes.flatMap((mesh) => {
    const brush = model.findBrushByMesh(mesh);
    return brush ? [brush] : [];
  });
}

describe('HandlerSolidHollow', () => {
  it('replaces a box with one valid wall per face that fills the original bounds', () => {
    const model = new SolidModel('HollowBox');
    const edges = new THREE.Vector3(4, 3, 5);
    const box = solidBrushToolsTestBoxAdd(model, edges, new THREE.Vector3(1, 2, -3));
    const originalBounds = solidBrushToolsTestWorldBounds([box]);
    const faceCount = box.brush.faces.length;
    const run = hollowTestRun(solidBrushToolsTestMeshes([box]), 0.5);
    expect(run.created).not.toBeNull();
    const walls = hollowTestWallBrushes(model, run.created ?? []);
    expect(walls).toHaveLength(faceCount);
    expect(model.findBrush(box.id)).toBeUndefined();
    walls.forEach((wall) => expect(SolidBrushValidator.validate(wall.brush).valid).toBe(true));
    expect(solidBrushToolsTestBoundsMatch(solidBrushToolsTestWorldBounds(walls), originalBounds)).toBe(true);
  });

  it('keeps every wall no thicker than the requested thickness along its smallest extent', () => {
    const model = new SolidModel('HollowThickness');
    const box = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(6, 6, 6), new THREE.Vector3());
    const thickness = 0.75;
    const run = hollowTestRun(solidBrushToolsTestMeshes([box]), thickness);
    const walls = hollowTestWallBrushes(model, run.created ?? []);
    for (const wall of walls) {
      const size = solidBrushToolsTestWorldBounds([wall]).getSize(new THREE.Vector3());
      expect(Math.min(size.x, size.y, size.z)).toBeCloseTo(thickness, 4);
    }
  });

  it('undoes and redoes the whole hollow as one step', () => {
    const model = new SolidModel('HollowUndo');
    const box = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(4, 4, 4), new THREE.Vector3(2, 0, 0));
    const before = model.getBrushes().length;
    const originalBounds = solidBrushToolsTestWorldBounds([box]);
    const run = hollowTestRun(solidBrushToolsTestMeshes([box]), 1);
    const wallCount = run.created?.length ?? 0;
    expect(model.getBrushes().length).toBe(before - 1 + wallCount);
    run.stack.undo();
    expect(model.getBrushes().length).toBe(before);
    const restored = model.findBrush(box.id);
    expect(restored).toBeDefined();
    if (restored) {
      expect(solidBrushToolsTestBoundsMatch(solidBrushToolsTestWorldBounds([restored]), originalBounds)).toBe(true);
    }
    run.stack.redo();
    expect(model.getBrushes().length).toBe(before - 1 + wallCount);
  });

  it('skips brushes thinner than twice the wall thickness and reports it', () => {
    const model = new SolidModel('HollowThin');
    const thickness = 1;
    const thinEdge = thickness * 2 - SOLID_BRUSH_TOOLS_TEST_EPSILON * 10;
    const box = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(4, thinEdge, 4), new THREE.Vector3());
    const before = model.getBrushes().length;
    const run = hollowTestRun(solidBrushToolsTestMeshes([box]), thickness);
    expect(run.created).toBeNull();
    expect(model.getBrushes().length).toBe(before);
    expect(run.messages.at(-1)).toContain('too thin');
    expect(run.stack.canUndo()).toBe(false);
  });

  it('reports an empty selection without touching the undo stack', () => {
    const run = hollowTestRun([], 1);
    expect(run.created).toBeNull();
    expect(run.messages.at(-1)).toContain('needs selected solid brushes');
    expect(run.stack.canUndo()).toBe(false);
  });
});
