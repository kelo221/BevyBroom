import { vi } from 'vitest';
import * as THREE from 'three';
import { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import type { DisplacementTestRig } from '../../displacement/displacement_test_rig.js';
import type { DisplacementPickTestView } from '../../displacement/displacement_pick_test_view.js';

/**
 * Creates a face mode coordinator over a rig's world with stand-in services.
 * The views are read on every viewport lookup, so a test may change the list
 * afterwards.
 *
 * @param rig Test rig whose world and undo stack the coordinator uses.
 * @param viewports Pick test views the coordinator treats as its viewports.
 * @param selectionManager Object selection the coordinator clears on entering
 *   face mode.
 * @returns New coordinator.
 */
export function coordinatorFaceModeTestCreate(
  rig: DisplacementTestRig,
  viewports: readonly DisplacementPickTestView[] = [],
  selectionManager: ManagerSelection = new ManagerSelection(),
): CoordinatorFaceMode {
  const scene = new THREE.Scene();
  return new CoordinatorFaceMode({
    getViewports: () =>
      viewports.map((view) => ({ getCamera: () => view.camera, getContentElement: () => view.pickElement })) as never,
    getPrimaryScene: () => scene,
    commandStack: rig.commandStack,
    gridSnap: new GridSnap(false, 1),
    worldObject: rig.world,
    selectionManager,
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
