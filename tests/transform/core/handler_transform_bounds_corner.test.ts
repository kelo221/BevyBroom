import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { CommandStack } from '@/commands/command_stack.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { TransformConstraint } from '@/transform/core/transform_constraint.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import {
  boundsTopPanePointerOver,
  boundsTopPaneRigCreate,
  boundsTopPaneSquareWorldPosition,
  type BoundsTopPaneRig,
} from '../bounds/bounds_top_pane_test_rig.js';

/** A top pane rig driven through the transform handler with undo. */
interface HandlerCornerRig extends BoundsTopPaneRig {
  handler: HandlerTransform;
  commandStack: CommandStack;
}

/**
 * Builds a top pane rig and a transform handler with a command stack.
 *
 * @returns Test rig.
 */
function handlerCornerRigCreate(): HandlerCornerRig {
  const paneRig = boundsTopPaneRigCreate();
  const commandStack = new CommandStack(16);
  const executor = new TransformExecutor(new GridSnap(false, 1));
  const handler = new HandlerTransform(
    paneRig.gizmo,
    new GizmoRaycaster(),
    executor,
    new TransformConstraint(),
    commandStack,
  );
  return { ...paneRig, handler, commandStack };
}

/**
 * Drags a square of the rig's box by a world travel and releases it.
 *
 * @param rig Test rig.
 * @param faces Faces of the square to drag.
 * @param travel World travel of the pointer.
 */
function squareDrag(rig: HandlerCornerRig, faces: readonly BoundsFace[], travel: THREE.Vector3): void {
  const pressPoint = boundsTopPaneSquareWorldPosition(rig, faces);
  const pivot = rig.box.position.clone();
  const press = boundsTopPanePointerOver(rig, 'pointerdown', pressPoint);
  const handles = rig.gizmo.getHandles();
  rig.handler.onPointerDown(rig.camera, rig.pickElement, press, handles, [rig.box], pivot, rig.gizmoGroup, 'xz');
  const move = boundsTopPanePointerOver(rig, 'pointermove', pressPoint.clone().add(travel));
  rig.handler.onPointerMove(rig.camera, rig.pickElement, move, pivot, [rig.box]);
  rig.handler.onPointerUp(pivot, [rig.box]);
}

/**
 * Returns the world box of the rig's selection.
 *
 * @param rig Test rig.
 * @returns World box.
 */
function selectionBoxOf(rig: HandlerCornerRig): THREE.Box3 {
  rig.box.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(rig.box);
}

/** Corner square drags through the transform handler record one undo step. */
describe('HandlerTransform corner square drag', () => {
  it('resizes both axes and restores both with a single undo', () => {
    const rig = handlerCornerRigCreate();
    const startBox = selectionBoxOf(rig);
    const startPosition = rig.box.position.clone();
    const startScale = rig.box.scale.clone();
    squareDrag(rig, [BoundsFace.NEG_X, BoundsFace.POS_Z], new THREE.Vector3(-0.8, 0, 0.6));
    const draggedSize = selectionBoxOf(rig).getSize(new THREE.Vector3());
    const startSize = startBox.getSize(new THREE.Vector3());
    expect(draggedSize.x).toBeGreaterThan(startSize.x + 0.5);
    expect(draggedSize.z).toBeGreaterThan(startSize.z + 0.3);
    expect(rig.commandStack.getUndoCount()).toBe(1);
    expect(rig.commandStack.undo()).toBe(true);
    expect(rig.box.position.distanceTo(startPosition)).toBeLessThan(1e-9);
    expect(rig.box.scale.distanceTo(startScale)).toBeLessThan(1e-9);
    expect(rig.commandStack.getUndoCount()).toBe(0);
    rig.gizmo.dispose();
  });
});
