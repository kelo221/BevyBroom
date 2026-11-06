import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { isSolidBrushMarkedNonConvex } from '@/edit/transform/brush_edit_convexity.js';
import { applyWorkingGeometryToTarget } from '@/edit/topology/topology_apply_working.js';
import { applyTopologyLoopCut } from '@/edit/topology/topology_loop_cut.js';
import { brushToWorkingGeometry } from '@/edit/topology/topology_working_from_brush.js';
import { captureTopologySnapshot } from '@/edit/topology/topology_snapshot_capture.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import type { TopologyBrushTarget } from '@/edit/topology/topology_target.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { findWorkingEdgeParallelToY } from './topology_test_edges.js';

/** Unit tests for committing brush edits that solid compilation must skip. */
describe('applyWorkingGeometryToTarget', () => {
  it('commits a coplanar loop cut and marks the brush so compilation skips it', () => {
    const model = new SolidModel('LoopCutBrush');
    const instance = model.addBoxBrush(2, SolidOperation.Additive);
    const beforeCount = instance.brush.vertices.length;
    const target = createBrushTarget(model, instance.id);
    const working = brushToWorkingGeometry(instance.brush);
    const edge = findWorkingEdgeParallelToY(working);
    expect(edge).not.toBeNull();
    if (!edge) {
      return;
    }
    expect(applyTopologyLoopCut(working, edge.vertexA, edge.vertexB, 0.5).applied).toBe(true);
    const written = applyWorkingGeometryToTarget(target, working, null);
    expect(written.applied).toBe(true);
    expect(instance.brush.vertices.length).toBe(beforeCount + 4);
    expect(instance.mesh).toBeTruthy();
    if (!instance.mesh) {
      return;
    }
    expect(isSolidBrushMarkedNonConvex(instance.mesh)).toBe(true);
  });

  it('remaps a displacement onto matching faces after a loop cut', () => {
    const model = new SolidModel('LoopCutDisplacement');
    const instance = model.addBoxBrush(2, SolidOperation.Additive);
    const sideIndex = faceIndexAlongAxis(instance, new THREE.Vector3(0, 0, 1));
    expect(sideIndex).toBeGreaterThanOrEqual(0);
    instance.faceDisplacementWrite(sideIndex, displacementSurfaceCreate(2, 0.5));
    const target = createBrushTarget(model, instance.id);
    const snapshot = captureTopologySnapshot(target);
    const working = brushToWorkingGeometry(instance.brush);
    const edge = findWorkingEdgeParallelToY(working);
    expect(edge).not.toBeNull();
    if (!edge || snapshot.kind !== 'brush') {
      return;
    }
    expect(applyTopologyLoopCut(working, edge.vertexA, edge.vertexB, 0.5).applied).toBe(true);
    expect(applyWorkingGeometryToTarget(target, working, snapshot).applied).toBe(true);
    expect(facesAlongAxisHaveElevation(instance, new THREE.Vector3(0, 0, 1), 0.5)).toBe(true);
  });
});

/**
 * Builds a brush topology target from a live instance id.
 *
 * @param model Solid model.
 * @param brushId Brush id.
 * @returns Target.
 */
function createBrushTarget(model: SolidModel, brushId: string): TopologyBrushTarget {
  const instance = model.findBrush(brushId);
  if (!instance) {
    throw new Error('missing brush');
  }
  return {
    kind: 'brush',
    targetId: instance.id,
    solidModel: model,
    brushId: instance.id,
    brush: instance.brush,
    mesh: instance.mesh,
  };
}

/**
 * Returns the first face whose plane normal matches the given direction.
 *
 * @param instance Brush instance.
 * @param direction Unit axis to match.
 * @returns Face index, or -1.
 */
function faceIndexAlongAxis(instance: SolidBrushInstance, direction: THREE.Vector3): number {
  return instance.brush.planes.findIndex((plane) => plane.normal.dot(direction) > 0.9);
}

/**
 * Returns whether every face matching a direction carries the given elevation.
 *
 * @param instance Brush instance after the topology commit.
 * @param direction Unit axis to match.
 * @param elevation Expected elevation.
 * @returns True when at least one matching face exists and all of them match.
 */
function facesAlongAxisHaveElevation(
  instance: SolidBrushInstance,
  direction: THREE.Vector3,
  elevation: number,
): boolean {
  const matching = instance.brush.planes
    .map((plane, index) => (plane.normal.dot(direction) > 0.9 ? index : -1))
    .filter((index) => index >= 0);
  return (
    matching.length > 0 && matching.every((index) => instance.faceDisplacementRead(index)?.elevation === elevation)
  );
}
