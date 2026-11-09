import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { TransformMode } from '@/types/transform_mode.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { BuilderOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import { TransformModalAxis } from '@/transform/modal/transform_modal_axis.js';
import { TransformModalHandlerIntegration } from '@/transform/modal/transform_modal_handler_integration.js';
import {
  transformModalBoundsResizeStepsBuild,
  type TransformModalBoundsResizeFaces,
} from '@/transform/modal/transform_modal_apply_bounds.js';

/** Last pointer travel of the dragged X face in corner rigs. */
const POINTER_PRIMARY_DELTA = 0.4;

/** Last pointer travel of the dragged Z face in corner rigs. */
const POINTER_SECONDARY_DELTA = 0.65;

/** Modal integration over a corner resize drag of one box. */
interface CornerNumericRig {
  integration: TransformModalHandlerIntegration;
  box: THREE.Mesh;
  startBox: THREE.Box3;
  rebakes: Array<{ translationLike: boolean; scaleLike: boolean }>;
}

/**
 * Builds a modal integration whose session holds a corner resize drag on the +X
 * and −Z faces of a box, with known last pointer travels.
 *
 * @returns Test rig.
 */
function cornerNumericRigCreate(): CornerNumericRig {
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshBasicMaterial());
  box.position.set(0.75, 0.5, -1.25);
  box.updateMatrixWorld(true);
  const gizmo = new GizmoTransform(Theme);
  gizmo.setMode(TransformMode.BOUNDS);
  const session = cornerSessionCreate(box);
  const integration = new TransformModalHandlerIntegration(
    Theme,
    session,
    gizmo,
    new TransformExecutor(new GridSnap(false, 1)),
  );
  const rebakes = rebakeRecorderAttach(integration);
  return { integration, box, startBox: new THREE.Box3().setFromObject(box), rebakes };
}

/**
 * Wires integration callbacks that record every texture rebake request.
 *
 * @param integration Modal integration under test.
 * @returns Recorded rebake flags, filled as rebakes happen.
 */
function rebakeRecorderAttach(integration: TransformModalHandlerIntegration): CornerNumericRig['rebakes'] {
  const rebakes: CornerNumericRig['rebakes'] = [];
  integration.setCallbacks({
    commitDrag: () => undefined,
    cancelDrag: () => undefined,
    rebakeTextures: (_objects, translationLike, scaleLike) => rebakes.push({ translationLike, scaleLike }),
    setStatusText: () => undefined,
    reapplyMouseDrivenTransform: () => undefined,
  });
  return rebakes;
}

/**
 * Builds a drag session holding a corner resize of a box.
 *
 * @param box Dragged box.
 * @returns Armed session.
 */
function cornerSessionCreate(box: THREE.Mesh): TransformDragSession {
  const session = new TransformDragSession();
  session.snapshotPreDragState([box]);
  session.dragObjects = [box];
  session.isBoundsResize = true;
  session.startBounds = new BuilderOrientedBounds().buildFromMeshes([box]);
  session.activeBoundsFace = BoundsFace.POS_X;
  session.secondaryBoundsFace = BoundsFace.NEG_Z;
  session.lastPointerBoundsResizeDelta = POINTER_PRIMARY_DELTA;
  session.lastPointerSecondaryBoundsResizeDelta = POINTER_SECONDARY_DELTA;
  return session;
}

/**
 * Returns how far each box side moved compared with the start box.
 *
 * @param rig Test rig.
 * @returns Growth of +X, −X, +Z and −Z sides outward.
 */
function sideGrowthOf(rig: CornerNumericRig): { posX: number; negX: number; posZ: number; negZ: number } {
  rig.box.updateMatrixWorld(true);
  const endBox = new THREE.Box3().setFromObject(rig.box);
  return {
    posX: endBox.max.x - rig.startBox.max.x,
    negX: rig.startBox.min.x - endBox.min.x,
    posZ: endBox.max.z - rig.startBox.max.z,
    negZ: rig.startBox.min.z - endBox.min.z,
  };
}

/** Corner drag faces with distinct pointer travels. */
const CORNER_FACES: TransformModalBoundsResizeFaces = {
  primaryFace: BoundsFace.POS_X,
  secondaryFace: BoundsFace.NEG_Z,
  primaryPointerDelta: POINTER_PRIMARY_DELTA,
  secondaryPointerDelta: POINTER_SECONDARY_DELTA,
};

/** Typed distances during bounds resize drags, edge and corner. */
describe('transformModalBoundsResizeStepsBuild', () => {
  it('moves only the dragged face of an edge drag', () => {
    const edgeFaces = { ...CORNER_FACES, secondaryFace: null };
    expect(transformModalBoundsResizeStepsBuild(edgeFaces, 2, TransformModalAxis.X)).toEqual([
      { face: BoundsFace.POS_X, deltaAlongNormal: 2 },
    ]);
  });

  it('moves both corner faces by the value without a lock on their axes', () => {
    const steps = transformModalBoundsResizeStepsBuild(CORNER_FACES, 2, TransformModalAxis.None);
    expect(steps.map((step) => step.deltaAlongNormal)).toEqual([2, 2]);
    const offAxisSteps = transformModalBoundsResizeStepsBuild(CORNER_FACES, 2, TransformModalAxis.Y);
    expect(offAxisSteps.map((step) => step.deltaAlongNormal)).toEqual([2, 2]);
  });

  it('moves the locked corner face by the value and keeps the other at its pointer travel', () => {
    const lockX = transformModalBoundsResizeStepsBuild(CORNER_FACES, 2, TransformModalAxis.X);
    expect(lockX).toEqual([
      { face: BoundsFace.POS_X, deltaAlongNormal: 2 },
      { face: BoundsFace.NEG_Z, deltaAlongNormal: POINTER_SECONDARY_DELTA },
    ]);
    const lockZ = transformModalBoundsResizeStepsBuild(CORNER_FACES, 2, TransformModalAxis.Z);
    expect(lockZ).toEqual([
      { face: BoundsFace.POS_X, deltaAlongNormal: POINTER_PRIMARY_DELTA },
      { face: BoundsFace.NEG_Z, deltaAlongNormal: 2 },
    ]);
  });
});

/** Typed distances applied to a corner drag through the modal integration. */
describe('TransformModalHandlerIntegration corner numeric resize', () => {
  it('grows both dragged sides by the typed value and keeps the opposite sides', () => {
    const rig = cornerNumericRigCreate();
    const typed = 1.5;
    expect(rig.integration.applyNumericValue(typed, TransformModalAxis.None)).toBe(true);
    const growth = sideGrowthOf(rig);
    expect(growth.posX).toBeCloseTo(typed, 6);
    expect(growth.negZ).toBeCloseTo(typed, 6);
    expect(growth.negX).toBeCloseTo(0, 6);
    expect(growth.posZ).toBeCloseTo(0, 6);
    expect(rig.rebakes).toEqual([{ translationLike: true, scaleLike: true }]);
  });

  it('applies a locked value to its face and keeps the other at its last pointer travel', () => {
    const rig = cornerNumericRigCreate();
    const typed = 1.5;
    expect(rig.integration.applyNumericValue(typed, TransformModalAxis.X)).toBe(true);
    const growth = sideGrowthOf(rig);
    expect(growth.posX).toBeCloseTo(typed, 6);
    expect(growth.negZ).toBeCloseTo(POINTER_SECONDARY_DELTA, 6);
    expect(growth.negX).toBeCloseTo(0, 6);
    expect(growth.posZ).toBeCloseTo(0, 6);
  });
});
