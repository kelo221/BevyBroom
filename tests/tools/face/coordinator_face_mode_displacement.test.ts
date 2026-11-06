import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import {
  displacementActionsSharedChangeListenerAdd,
  displacementActionsSharedRead,
} from '@/displacement/controller/displacement_actions_shared.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { PanelDisplacementTab } from '@/displacement/ui/panel_displacement_tab.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { FaceTextureApplyCoordinator } from '@/tools/face/texture_apply/face_texture_apply_coordinator.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceCenter,
  displacementTestFaceFacing,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../../displacement/displacement_test_rig.js';
import { displacementPickTestViewCreate } from '../../displacement/displacement_pick_test_view.js';
import { coordinatorFaceModeTestCreate } from './coordinator_face_mode_test_rig.js';

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
 * Creates a Displacement tab over the shared displacement actions.
 *
 * @returns New tab.
 */
function coordinatorTestTabCreate(): PanelDisplacementTab {
  return new PanelDisplacementTab({
    actionsRead: displacementActionsSharedRead,
    changeListenerAdd: displacementActionsSharedChangeListenerAdd,
    floatingHost: document.body,
    statusReport: () => undefined,
    afterChange: () => undefined,
  });
}

/**
 * Finds the Create button of a Displacement tab.
 *
 * @param tab Displacement tab.
 * @returns Create button.
 */
function coordinatorTestCreateButtonFind(tab: PanelDisplacementTab): HTMLButtonElement {
  const button = [...tab.getElement().querySelectorAll('button')].find((entry) => entry.textContent === 'Create');
  if (!button) throw new Error('Create button missing');
  return button;
}

/**
 * Clicks the Create button of a Displacement tab.
 *
 * @param tab Displacement tab.
 */
function coordinatorTestCreateClick(tab: PanelDisplacementTab): void {
  coordinatorTestCreateButtonFind(tab).click();
}

/** Displacement tool lifetime of the face mode coordinator. */
describe('CoordinatorFaceMode displacement tools', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
  });

  it('paints on a right press over a selected displaced face instead of arming texture apply only with a paint tool', () => {
    const rig = displacementTestRigCreate('CoordinatorRightPaint');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 1, 4), new THREE.Vector3(2, 1, -3));
    const up = new THREE.Vector3(0, 1, 0);
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, up));
    displacementTestCreate(rig, target, 3);
    const view = displacementPickTestViewCreate(displacementTestFaceCenter(target), up, 8);
    const coordinator = coordinatorFaceModeTestCreate(rig, [view]);
    coordinator.enterFaceSelectionModeFromTool();
    coordinatorTestFaceSelect(coordinator, rig, target);
    const textureApplyArm = vi.spyOn(FaceTextureApplyCoordinator.prototype, 'secondaryPressBegin');
    const { clientX, clientY } = view.event;
    expect(coordinator.beginFaceSelectSecondaryPress(clientX, clientY)).toBe(false);
    expect(textureApplyArm).toHaveBeenCalledTimes(1);
    getStateFaceEditSession().sheetOpenWrite(true);
    getStateFaceEditSession().activeTabIdWrite('displacement');
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry', raise: true, distance: 0.2 });
    expect(coordinator.beginFaceSelectSecondaryPress(clientX, clientY)).toBe(true);
    expect(textureApplyArm).toHaveBeenCalledTimes(1);
    expect(coordinator.isFaceSelectStrokeActive()).toBe(true);
    coordinator.endFaceSelectPointerUp();
    expect(coordinator.isFaceSelectStrokeActive()).toBe(false);
    expect(Math.min(...displacementTestOffsetsRead(target))).toBeLessThan(0);
    coordinator.dispose();
  });

  it('rebinds the Displacement tab to the live coordinator when the face tool is rebuilt', () => {
    const rig = displacementTestRigCreate('CoordinatorRebind');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(0, 1, 0));
    const oldTarget = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(1, 0, 0)));
    const liveTarget = displacementTestTarget(
      rig,
      brush,
      displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)),
    );
    const oldCoordinator = coordinatorFaceModeTestCreate(rig);
    const oldActions = displacementActionsSharedRead();
    coordinatorTestFaceSelect(oldCoordinator, rig, oldTarget);
    const liveCoordinator = coordinatorFaceModeTestCreate(rig);
    coordinatorTestFaceSelect(liveCoordinator, rig, liveTarget);
    oldCoordinator.dispose();
    expect(displacementActionsSharedRead()).not.toBeNull();
    expect(displacementActionsSharedRead()).not.toBe(oldActions);
    const tab = coordinatorTestTabCreate();
    coordinatorTestCreateClick(tab);
    expect(displacementTestOffsetsRead(liveTarget).length).toBeGreaterThan(0);
    expect(displacementTestOffsetsRead(oldTarget)).toEqual([]);
    tab.dispose();
    liveCoordinator.dispose();
    expect(displacementActionsSharedRead()).toBeNull();
  });

  it('enables Create on the Displacement tab when the coordinator selects a face', () => {
    const rig = displacementTestRigCreate('CoordinatorEnable');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(0, 1, 0));
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
    const coordinator = coordinatorFaceModeTestCreate(rig);
    const tab = coordinatorTestTabCreate();
    expect(coordinatorTestCreateButtonFind(tab).disabled).toBe(true);
    coordinatorTestFaceSelect(coordinator, rig, target);
    expect(coordinatorTestCreateButtonFind(tab).disabled).toBe(false);
    tab.dispose();
    coordinator.dispose();
  });

  it('can be disposed twice without touching tools installed later', () => {
    const rig = displacementTestRigCreate('CoordinatorDisposeTwice');
    const coordinator = coordinatorFaceModeTestCreate(rig);
    coordinator.dispose();
    const replacement = coordinatorFaceModeTestCreate(rig);
    const replacementActions = displacementActionsSharedRead();
    coordinator.dispose();
    expect(displacementActionsSharedRead()).toBe(replacementActions);
    replacement.dispose();
  });
});
