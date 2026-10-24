import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { solidBrushesWorldVertexBounds } from '@/solid/model/solid_brush_world_bounds.js';
import {
  HandlerSolidBrushTools,
  type HandlerSolidBrushToolsDeps,
} from '@/tools/csg/solid/handler_solid_brush_tools.js';
import { solidBrushToolsTestBoxAdd, solidBrushToolsTestMeshes } from './solid_brush_tools_test_helpers.js';

/** Brush tools wired to spies over a selection. */
interface BrushToolsTestRig {
  readonly tools: HandlerSolidBrushTools;
  readonly deps: HandlerSolidBrushToolsDeps;
  readonly stack: CommandStack;
  readonly selectionReplace: ReturnType<typeof vi.fn>;
  readonly afterWorldMutation: ReturnType<typeof vi.fn>;
}

/**
 * Builds brush tools over a fixed selection and an optional camera.
 *
 * @param brushes Selected brushes.
 * @param camera Active view camera, or null.
 * @returns Test rig.
 */
function brushToolsTestRigCreate(
  brushes: readonly SolidBrushInstance[],
  camera: THREE.Camera | null,
): BrushToolsTestRig {
  const stack = new CommandStack(16);
  const selectionReplace = vi.fn();
  const afterWorldMutation = vi.fn();
  const deps: HandlerSolidBrushToolsDeps = {
    commandStack: stack,
    gridSnap: new GridSnap(true, 1),
    selectedObjectsRead: () => solidBrushToolsTestMeshes(brushes),
    selectedFacesRead: () => [],
    activeCameraRead: () => camera,
    isTexturePositionLockEnabled: () => true,
    showStatusMessage: () => undefined,
    selectionReplace,
    afterWorldMutation,
  };
  return { tools: new HandlerSolidBrushTools(deps), deps, stack, selectionReplace, afterWorldMutation };
}

/**
 * Builds a camera at a position looking at the origin.
 *
 * @param position Camera position.
 * @returns Perspective camera.
 */
function brushToolsTestCameraAt(position: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(position);
  camera.lookAt(new THREE.Vector3());
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Builds two boxes in one model.
 *
 * @returns Brushes.
 */
function brushToolsTestBoxes(): SolidBrushInstance[] {
  const model = new SolidModel('BrushTools');
  return [
    solidBrushToolsTestBoxAdd(model, new THREE.Vector3(4, 4, 4), new THREE.Vector3(1, 0, 0)),
    solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2, 2, 2), new THREE.Vector3(6, 3, 1)),
  ];
}

describe('HandlerSolidBrushTools', () => {
  it('flips horizontally along X for a front view and along Z for a side view', () => {
    const front = brushToolsTestRigCreate(brushToolsTestBoxes(), brushToolsTestCameraAt(new THREE.Vector3(0, 0, 10)));
    expect(front.tools.flip('horizontal')?.axis).toBe('x');
    const side = brushToolsTestRigCreate(brushToolsTestBoxes(), brushToolsTestCameraAt(new THREE.Vector3(10, 0, 0)));
    expect(side.tools.flip('horizontal')?.axis).toBe('z');
  });

  it('flips horizontally along X without an active view and vertically along Y', () => {
    const rig = brushToolsTestRigCreate(brushToolsTestBoxes(), null);
    expect(rig.tools.flip('horizontal')?.axis).toBe('x');
    expect(rig.tools.flip('vertical')?.axis).toBe('y');
    expect(rig.afterWorldMutation).toHaveBeenCalledTimes(2);
  });

  it('selects the walls a hollow created', () => {
    const rig = brushToolsTestRigCreate(brushToolsTestBoxes(), null);
    const walls = rig.tools.hollow();
    expect(walls?.length ?? 0).toBeGreaterThan(0);
    expect(rig.selectionReplace).toHaveBeenCalledWith(walls);
  });

  it('selects the brush a convex merge created', () => {
    const rig = brushToolsTestRigCreate(brushToolsTestBoxes(), null);
    const merged = rig.tools.convexMerge();
    expect(merged?.mesh).toBeTruthy();
    expect(rig.selectionReplace).toHaveBeenCalledWith([merged?.mesh]);
  });

  it('shears the selection so its top side slides by the offset and its bottom stays put', () => {
    const brushes = brushToolsTestBoxes();
    const before = solidBrushesWorldVertexBounds(brushes);
    const offset = 1.5;
    const rig = brushToolsTestRigCreate(brushes, null);
    expect(rig.tools.shear('y', 'x', offset)?.edited).toHaveLength(brushes.length);
    const after = solidBrushesWorldVertexBounds(brushes);
    expect(after.min.y).toBeCloseTo(before.min.y, 4);
    expect(after.max.y).toBeCloseTo(before.max.y, 4);
    expect(after.max.x).toBeCloseTo(before.max.x + offset, 4);
    expect(after.min.x).toBeCloseTo(before.min.x, 4);
  });

  it('refuses a shear along its own axis without an undo entry', () => {
    const rig = brushToolsTestRigCreate(brushToolsTestBoxes(), null);
    expect(rig.tools.shear('x', 'x', 1)).toBeNull();
    expect(rig.stack.canUndo()).toBe(false);
  });

  it('reports the brushes whose vertices snapped and null for an empty selection', () => {
    const brushes = brushToolsTestBoxes();
    const rig = brushToolsTestRigCreate(brushes, null);
    expect(rig.tools.snapVertices('integer')?.edited).toHaveLength(brushes.length);
    const empty = brushToolsTestRigCreate([], null);
    expect(empty.tools.snapVertices('grid')).toBeNull();
    expect(empty.stack.canUndo()).toBe(false);
  });
});
