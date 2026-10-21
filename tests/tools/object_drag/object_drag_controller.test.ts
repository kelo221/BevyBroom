import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { objectDragPointerSampleCreate } from '@/tools/object_drag/object_drag_pointer_sample.js';
import type { ObjectDragSession } from '@/tools/object_drag/object_drag_session.js';
import { ObjectDragMoveSession } from '@/tools/object_drag_move/object_drag_move_session.js';
import { ShapeDrawSession } from '@/tools/shape_draw/shape_draw_session.js';
import { OBJECT_DRAG_TEST_VIEWPORT_RECT, objectDragTestClientPoint } from './object_drag_test_viewport.js';
import {
  objectDragTestControllerRigCreate,
  objectDragTestMeshTopCenter,
  type ObjectDragTestControllerRig,
} from './object_drag_test_controller.js';

/**
 * Begins a drag with the press over a world point and cancels it at once.
 *
 * @param rig Test rig.
 * @param pressWorld World point under the press.
 * @param ctrlKey True when Ctrl is held at the press.
 * @returns Session the controller started, or null.
 */
function controllerPressAt(
  rig: ObjectDragTestControllerRig,
  pressWorld: THREE.Vector3,
  ctrlKey = false,
): ObjectDragSession | null {
  const point = objectDragTestClientPoint(rig.testViewport, pressWorld);
  const session = rig.controller.dragBegin(
    objectDragPointerSampleCreate(point.clientX, point.clientY, { shiftKey: false, ctrlKey, altKey: false }),
  );
  session?.cancel();
  return session;
}

/**
 * Returns the two meshes of the rig.
 *
 * @param rig Test rig.
 * @returns First and second mesh.
 */
function rigMeshPair(rig: ObjectDragTestControllerRig): [THREE.Mesh, THREE.Mesh] {
  const [first, second] = rig.meshes;
  if (!first || !second) {
    throw new Error('The controller rig must hold two meshes');
  }
  return [first, second];
}

/**
 * Proves which session a drag starts: a move on selected objects, a box draw on
 * anything while nothing is selected, and nothing otherwise.
 */
describe('ObjectDragController', () => {
  const emptyGround = new THREE.Vector3(0, 0, 6);

  it('moves the selection when the press is on a selected object, with or without Ctrl', () => {
    const rig = objectDragTestControllerRigCreate();
    const [first] = rigMeshPair(rig);
    rig.selection.selectObject(first);
    expect(controllerPressAt(rig, objectDragTestMeshTopCenter(first))).toBeInstanceOf(ObjectDragMoveSession);
    expect(controllerPressAt(rig, objectDragTestMeshTopCenter(first), true)).toBeInstanceOf(ObjectDragMoveSession);
  });

  it('moves when the pressed mesh lies under a selected hierarchy object', () => {
    const rig = objectDragTestControllerRigCreate();
    const [first] = rigMeshPair(rig);
    const group = new THREE.Group();
    rig.world.add(group);
    group.add(first);
    rig.selection.setSelection([], [group]);
    expect(controllerPressAt(rig, objectDragTestMeshTopCenter(first))).toBeInstanceOf(ObjectDragMoveSession);
  });

  it('draws a box on empty space or on an object while nothing is selected', () => {
    const rig = objectDragTestControllerRigCreate();
    const [first] = rigMeshPair(rig);
    expect(controllerPressAt(rig, emptyGround)).toBeInstanceOf(ShapeDrawSession);
    expect(controllerPressAt(rig, objectDragTestMeshTopCenter(first))).toBeInstanceOf(ShapeDrawSession);
  });

  it('does nothing on empty space or an unselected object while something is selected', () => {
    const rig = objectDragTestControllerRigCreate();
    const [first, second] = rigMeshPair(rig);
    rig.selection.selectObject(first);
    expect(controllerPressAt(rig, emptyGround)).toBeNull();
    expect(controllerPressAt(rig, objectDragTestMeshTopCenter(second))).toBeNull();
  });

  it('does nothing with Ctrl held while nothing is selected', () => {
    const rig = objectDragTestControllerRigCreate();
    expect(controllerPressAt(rig, emptyGround, true)).toBeNull();
  });

  it('does nothing outside every view or while object editing is not allowed', () => {
    const rig = objectDragTestControllerRigCreate();
    const outside = rig.controller.dragBegin(
      objectDragPointerSampleCreate(OBJECT_DRAG_TEST_VIEWPORT_RECT.right + 50, OBJECT_DRAG_TEST_VIEWPORT_RECT.top, {
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
      }),
    );
    expect(outside).toBeNull();
    rig.editing.allowed = false;
    expect(controllerPressAt(rig, emptyGround)).toBeNull();
  });
});
