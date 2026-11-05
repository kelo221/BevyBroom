import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import { displacementActionsSharedRead } from '@/displacement/controller/displacement_actions_shared.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { PanelDisplacementTab } from '@/displacement/ui/panel_displacement_tab.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../../displacement/displacement_test_rig.js';

/**
 * Creates a face mode coordinator over a rig's world with stand-in services.
 *
 * @param rig Test rig whose world and undo stack the coordinator uses.
 * @returns New coordinator.
 */
function coordinatorTestCreate(rig: DisplacementTestRig): CoordinatorFaceMode {
  const scene = new THREE.Scene();
  return new CoordinatorFaceMode({
    getViewports: () => [],
    getPrimaryScene: () => scene,
    commandStack: rig.commandStack,
    gridSnap: new GridSnap(false, 1),
    worldObject: rig.world,
    selectionManager: new ManagerSelection(),
    statusBar: { setSelectionModeInfo: () => undefined } as never,
    keyboardShortcutHandler: {
      setOnSelectionModeToggle: () => undefined,
      setOnExtrudeFaces: () => undefined,
      isKeyDown: () => false,
      isAltDown: () => false,
      modifiersStateRead: () => ({ ctrl: false, shift: false, alt: false }),
    } as never,
    showStatusMessage: vi.fn(),
    syncPrimitivesToViewports: () => undefined,
    updateShadingMeshes: () => undefined,
    refreshOutliner: () => undefined,
  });
}

/**
 * Selects one brush face in a coordinator's face selection.
 *
 * @param coordinator Coordinator whose selection receives the face.
 * @param rig Test rig owning the result mesh.
 * @param target Brush face to select.
 */
function coordinatorTestFaceSelect(
  coordinator: CoordinatorFaceMode,
  rig: DisplacementTestRig,
  target: SolidFaceTextureTarget,
): void {
  const resultMesh = rig.model.getResultMesh();
  const triangleIndex = findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex);
  coordinator.getFaceExtrusionController().selectFace(resultMesh, triangleIndex, false);
}

/**
 * Clicks the Create button of a Displacement tab.
 *
 * @param tab Displacement tab.
 */
function coordinatorTestCreateClick(tab: PanelDisplacementTab): void {
  const button = [...tab.getElement().querySelectorAll('button')].find((entry) => entry.textContent === 'Create');
  if (!button) throw new Error('Create button missing');
  button.click();
}

/** Displacement tool lifetime of the face mode coordinator. */
describe('CoordinatorFaceMode displacement tools', () => {
  afterEach(() => getStateDisplacementSculpt().reset());

  it('rebinds the Displacement tab to the live coordinator when the face tool is rebuilt', () => {
    const rig = displacementTestRigCreate('CoordinatorRebind');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(0, 1, 0));
    const oldTarget = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(1, 0, 0)));
    const liveTarget = displacementTestTarget(
      rig,
      brush,
      displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)),
    );
    const oldCoordinator = coordinatorTestCreate(rig);
    const oldActions = displacementActionsSharedRead();
    coordinatorTestFaceSelect(oldCoordinator, rig, oldTarget);
    const liveCoordinator = coordinatorTestCreate(rig);
    coordinatorTestFaceSelect(liveCoordinator, rig, liveTarget);
    oldCoordinator.dispose();
    expect(displacementActionsSharedRead()).not.toBeNull();
    expect(displacementActionsSharedRead()).not.toBe(oldActions);
    const tab = new PanelDisplacementTab({
      actionsRead: displacementActionsSharedRead,
      statusReport: () => undefined,
      afterChange: () => undefined,
    });
    coordinatorTestCreateClick(tab);
    expect(displacementTestOffsetsRead(liveTarget).length).toBeGreaterThan(0);
    expect(displacementTestOffsetsRead(oldTarget)).toEqual([]);
    tab.dispose();
    liveCoordinator.dispose();
    expect(displacementActionsSharedRead()).toBeNull();
  });

  it('can be disposed twice without touching tools installed later', () => {
    const rig = displacementTestRigCreate('CoordinatorDisposeTwice');
    const coordinator = coordinatorTestCreate(rig);
    coordinator.dispose();
    const replacement = coordinatorTestCreate(rig);
    const replacementActions = displacementActionsSharedRead();
    coordinator.dispose();
    expect(displacementActionsSharedRead()).toBe(replacementActions);
    replacement.dispose();
  });
});
