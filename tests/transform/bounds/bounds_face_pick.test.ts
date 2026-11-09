import { describe, expect, it } from 'vitest';
import { BoundsFace } from '@/types/bounds_face.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import type { GizmoHandle } from '@/transform/gizmo/gizmo_handle.js';
import {
  boundsFaceFromHandleRead,
  boundsHandleFacesFromHandleRead,
  pickBoundsHandleFace,
} from '@/transform/bounds/bounds_face_pick.js';
import { boundsHandleFacesEqual } from '@/transform/bounds/handle/bounds_handle_faces.js';
import {
  boundsTopPanePointerOver,
  boundsTopPaneRigCreate,
  boundsTopPaneSquareWorldPosition,
  type BoundsTopPaneRig,
} from './bounds_top_pane_test_rig.js';

/**
 * Picks the bounds handle under the square of some faces in the top pane.
 *
 * @param rig Top pane rig.
 * @param faces Faces of the square under the pointer.
 * @returns Picked handle, or null.
 */
function handleUnderSquare(rig: BoundsTopPaneRig, faces: readonly BoundsFace[]): GizmoHandle | null {
  const event = boundsTopPanePointerOver(rig, 'pointermove', boundsTopPaneSquareWorldPosition(rig, faces));
  const handles = rig.gizmo.getHandles();
  return pickBoundsHandleFace(
    new GizmoRaycaster(),
    rig.gizmo,
    rig.camera,
    rig.pickElement,
    event,
    handles,
    rig.gizmoGroup,
    'xz',
  );
}

/** Picking bounds handles and reading the faces they drag. */
describe('bounds face pick', () => {
  it('picks an edge square and reads its single face', () => {
    const rig = boundsTopPaneRigCreate();
    const handle = handleUnderSquare(rig, [BoundsFace.POS_Z]);
    expect(handle).not.toBeNull();
    if (handle) {
      expect(boundsHandleFacesFromHandleRead(handle)).toEqual([BoundsFace.POS_Z]);
      expect(boundsFaceFromHandleRead(handle)).toBe(BoundsFace.POS_Z);
    }
    rig.gizmo.dispose();
  });

  it('picks a corner square and reads both faces but no single face', () => {
    const rig = boundsTopPaneRigCreate();
    const cornerFaces = [BoundsFace.NEG_X, BoundsFace.NEG_Z];
    const handle = handleUnderSquare(rig, cornerFaces);
    expect(handle).not.toBeNull();
    if (handle) {
      expect(boundsHandleFacesEqual(boundsHandleFacesFromHandleRead(handle), cornerFaces)).toBe(true);
      expect(boundsFaceFromHandleRead(handle)).toBeNull();
    }
    rig.gizmo.dispose();
  });

  it('picks nothing over the middle of the selection', () => {
    const rig = boundsTopPaneRigCreate();
    const event = boundsTopPanePointerOver(rig, 'pointermove', rig.box.position.clone());
    const handles = rig.gizmo.getHandles();
    const handle = pickBoundsHandleFace(
      new GizmoRaycaster(),
      rig.gizmo,
      rig.camera,
      rig.pickElement,
      event,
      handles,
      rig.gizmoGroup,
      'xz',
    );
    expect(handle).toBeNull();
    rig.gizmo.dispose();
  });
});
