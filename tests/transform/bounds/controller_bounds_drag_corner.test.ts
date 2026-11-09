import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { ControllerBoundsDrag } from '@/transform/bounds/controller_bounds_drag.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { boundsHandleFacesEqual } from '@/transform/bounds/handle/bounds_handle_faces.js';
import {
  boundsTopPaneBoxCornerXZ,
  boundsTopPanePointerOver,
  boundsTopPaneRigCreate,
  boundsTopPaneSquareWorldPosition,
  type BoundsTopPaneRig,
} from './bounds_top_pane_test_rig.js';

/** A top pane rig with a bounds drag controller over it. */
interface CornerDragRig extends BoundsTopPaneRig {
  controller: ControllerBoundsDrag;
  session: TransformDragSession;
}

/**
 * Builds a top pane rig and a bounds drag controller sharing its gizmo.
 *
 * @returns Test rig.
 */
function cornerDragRigCreate(): CornerDragRig {
  const paneRig = boundsTopPaneRigCreate();
  const session = new TransformDragSession();
  const executor = new TransformExecutor(new GridSnap(false, 1));
  const controller = new ControllerBoundsDrag(session, paneRig.gizmo, new GizmoRaycaster(), executor);
  return { ...paneRig, controller, session };
}

/**
 * Presses the pointer over a square of the rig's box.
 *
 * @param rig Test rig.
 * @param pressPoint World point under the pointer.
 */
function pointerPress(rig: CornerDragRig, pressPoint: THREE.Vector3): void {
  rig.controller.beginPointerDown(
    rig.camera,
    rig.pickElement,
    boundsTopPanePointerOver(rig, 'pointerdown', pressPoint),
    rig.gizmo.getHandles(),
    [rig.box],
    rig.box.position.clone(),
    rig.gizmoGroup,
    'xz',
  );
}

/**
 * Dragging a 2D corner square resizes both in-plane axes while the opposite
 * corner stays anchored.
 */
describe('ControllerBoundsDrag corner squares', () => {
  it('picks a corner square as two faces and highlights both', () => {
    const rig = cornerDragRigCreate();
    const cornerFaces = [BoundsFace.POS_X, BoundsFace.NEG_Z];
    const hover = boundsTopPanePointerOver(rig, 'pointermove', boundsTopPaneSquareWorldPosition(rig, cornerFaces));
    const handles = rig.gizmo.getHandles();
    rig.controller.updateFaceHoverHighlight(rig.camera, rig.pickElement, hover, handles, rig.gizmoGroup, 'xz');
    expect(boundsHandleFacesEqual(rig.gizmo.getHighlightedBoundsFaces(), cornerFaces)).toBe(true);
    rig.gizmo.dispose();
  });

  it('resizes both axes with the opposite corner fixed', () => {
    const rig = cornerDragRigCreate();
    const startBox = new THREE.Box3().setFromObject(rig.box);
    const fixedCorner = boundsTopPaneBoxCornerXZ(startBox, -1, 1);
    const pressPoint = boundsTopPaneSquareWorldPosition(rig, [BoundsFace.POS_X, BoundsFace.NEG_Z]);
    pointerPress(rig, pressPoint);
    expect(rig.session.isBoundsResize).toBe(true);
    expect([rig.session.activeBoundsFace, rig.session.secondaryBoundsFace]).toEqual([
      BoundsFace.POS_X,
      BoundsFace.NEG_Z,
    ]);
    const travel = new THREE.Vector3(0.5, 0, -0.75);
    const move = boundsTopPanePointerOver(rig, 'pointermove', pressPoint.clone().add(travel));
    rig.controller.handleMove(rig.camera, rig.pickElement, move, [rig.box]);
    rig.box.updateMatrixWorld(true);
    const endBox = new THREE.Box3().setFromObject(rig.box);
    const startSize = startBox.getSize(new THREE.Vector3());
    const endSize = endBox.getSize(new THREE.Vector3());
    expect(endSize.x).toBeCloseTo(startSize.x + travel.x, 1);
    expect(endSize.z).toBeCloseTo(startSize.z - travel.z, 1);
    expect(endSize.y).toBeCloseTo(startSize.y, 6);
    expect(boundsTopPaneBoxCornerXZ(endBox, -1, 1).distanceTo(fixedCorner)).toBeLessThan(1e-6);
    rig.gizmo.dispose();
  });

  it('keeps edge squares one-sided', () => {
    const rig = cornerDragRigCreate();
    pointerPress(rig, boundsTopPaneSquareWorldPosition(rig, [BoundsFace.NEG_X]));
    expect(rig.session.activeBoundsFace).toBe(BoundsFace.NEG_X);
    expect(rig.session.secondaryBoundsFace).toBeNull();
    rig.gizmo.dispose();
  });
});
