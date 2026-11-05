import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  resolveLayoutGizmoOrientation,
  updateLayoutGizmoCameraScale,
  updateLayoutGizmoPivot,
  type ContextHelpersLayoutGizmo,
} from '@/layout/setup/helpers_layout_gizmo.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { Theme } from '@/theme.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TransformMode } from '@/types/transform_mode.js';
import { TransformSpace } from '@/types/transform_space.js';

describe('layout_gizmo_helpers', () => {
  it('uses the workspace grid rotation for global space', () => {
    const mesh = new THREE.Mesh();
    mesh.rotation.set(0.5, 1.0, -0.25);
    mesh.updateMatrixWorld(true);
    const { gridSnap, orientation } = createRotatedGridSnap();
    const resolved = resolveLayoutGizmoOrientation({ transformSpace: TransformSpace.Global, gridSnap }, [mesh]);
    expect(resolved.equals(orientation)).toBe(true);
  });

  it('uses the workspace grid rotation for global space with an empty selection', () => {
    const { gridSnap, orientation } = createRotatedGridSnap();
    const resolved = resolveLayoutGizmoOrientation({ transformSpace: TransformSpace.Global, gridSnap }, []);
    expect(resolved.equals(orientation)).toBe(true);
  });

  it('uses the single selected object world rotation for local space', () => {
    const mesh = new THREE.Mesh();
    mesh.rotation.set(0.25, -0.5, 0.75);
    mesh.updateMatrixWorld(true);
    const expected = new THREE.Quaternion();
    mesh.getWorldQuaternion(expected);
    const { gridSnap } = createRotatedGridSnap();
    const orientation = resolveLayoutGizmoOrientation({ transformSpace: TransformSpace.Local, gridSnap }, [mesh]);
    expect(orientation.equals(expected)).toBe(true);
  });

  it('uses identity orientation for multi-select local space', () => {
    const first = new THREE.Mesh();
    const second = new THREE.Mesh();
    first.rotation.set(0.1, 0.2, 0.3);
    second.rotation.set(-0.2, 0.4, -0.1);
    first.updateMatrixWorld(true);
    second.updateMatrixWorld(true);
    const { gridSnap } = createRotatedGridSnap();
    const orientation = resolveLayoutGizmoOrientation({ transformSpace: TransformSpace.Local, gridSnap }, [
      first,
      second,
    ]);
    expect(orientation.equals(new THREE.Quaternion())).toBe(true);
  });

  it('forbids scaling and resizing a selection holding a light or a game entity and allows it otherwise', () => {
    const light = markerRequire(LightOwner.markerOf(LightOwner.createDefault('Lamp', 'point')));
    const gameEntity = markerRequire(GameEntityOwner.markerOf(GameEntityOwner.createDefault('door_main')));
    const room = markerRequire(RoomOwner.markerOf(RoomOwner.createDefault('Hall')));
    const brush = new THREE.Mesh(new THREE.BoxGeometry());
    const selections: THREE.Mesh[][] = [
      [light],
      [light, brush],
      [gameEntity],
      [gameEntity, brush],
      [brush],
      [room],
      [],
    ];
    const policies = selections.map((selection) => gizmoScalePolicyAfterPivotUpdate(selection));
    expect(policies).toEqual([
      { isScaleAllowed: false, isResizeAllowed: false },
      { isScaleAllowed: false, isResizeAllowed: false },
      { isScaleAllowed: false, isResizeAllowed: false },
      { isScaleAllowed: false, isResizeAllowed: false },
      { isScaleAllowed: true, isResizeAllowed: true },
      { isScaleAllowed: true, isResizeAllowed: true },
      { isScaleAllowed: true, isResizeAllowed: true },
    ]);
  });

  it('builds no scale handles in Scale mode while the selection may not be scaled', () => {
    const gameEntity = markerRequire(GameEntityOwner.markerOf(GameEntityOwner.createDefault('door_main')));
    const brush = new THREE.Mesh(new THREE.BoxGeometry());
    const gizmo = new GizmoTransform(Theme);
    gizmo.setMode(TransformMode.SCALE);
    gizmoScalePolicyAfterPivotUpdate([gameEntity], gizmo);
    expect(gizmo.getHandles()).toHaveLength(0);
    gizmoScalePolicyAfterPivotUpdate([brush], gizmo);
    expect(gizmo.getHandles().length).toBeGreaterThan(0);
    gizmo.setMode(TransformMode.TRANSLATE);
    gizmoScalePolicyAfterPivotUpdate([gameEntity], gizmo);
    expect(gizmo.getHandles().length).toBeGreaterThan(0);
    gizmo.dispose();
  });

  it('does not stamp a shared camera scale onto viewport clones from the global path', () => {
    const updateScaleForCamera = vi.fn();
    const context = {
      selectionManager: {
        getSelectedObjectCount: () => 1,
      },
      transformGizmo: {
        updateScaleForCamera,
      },
      getGizmoScaleCamera: () => new THREE.PerspectiveCamera(),
    } as unknown as ContextHelpersLayoutGizmo;
    updateLayoutGizmoCameraScale(context);
    expect(updateScaleForCamera).not.toHaveBeenCalled();
  });
});

/**
 * Builds a grid snap whose workspace basis is a non-identity rotation.
 *
 * @returns Snap store and the quaternion written into it.
 */
function createRotatedGridSnap(): { gridSnap: GridSnap; orientation: THREE.Quaternion } {
  const gridSnap = new GridSnap(true, 1);
  const axis = new THREE.Vector3(1, 1, 0).normalize();
  const orientation = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 5);
  gridSnap.setWorkspaceBasisQuaternion(orientation);
  return { gridSnap, orientation };
}

/**
 * Returns an entity marker, failing the test when the entity has none.
 *
 * @param marker Marker mesh, or null.
 * @returns The marker mesh.
 */
function markerRequire(marker: THREE.Mesh | null): THREE.Mesh {
  if (!marker) {
    throw new Error('entity has no marker mesh');
  }
  return marker;
}

/**
 * Runs a gizmo pivot update for a selection on a real transform gizmo and
 * reports whether it allowed scaling and resizing the selection.
 *
 * @param selection Selected meshes.
 * @param gizmo Gizmo to update; a fresh one when omitted.
 * @returns Scale handle and bounds resize permissions after the update.
 */
function gizmoScalePolicyAfterPivotUpdate(
  selection: THREE.Mesh[],
  gizmo: GizmoTransform = new GizmoTransform(Theme),
): { isScaleAllowed: boolean; isResizeAllowed: boolean } {
  const context = {
    selectionManager: { getSelectedObjects: () => new Set(selection) },
    transformExecutor: { computePivot: () => new THREE.Vector3() },
    transformGizmo: gizmo,
    transformSpace: TransformSpace.Global,
    gridSnap: new GridSnap(true, 1),
    getGizmoScaleCamera: () => null,
  } as unknown as ContextHelpersLayoutGizmo;
  updateLayoutGizmoPivot(context);
  return { isScaleAllowed: gizmo.isScaleHandlesAllowed(), isResizeAllowed: gizmo.isBoundsResizeAllowed() };
}
