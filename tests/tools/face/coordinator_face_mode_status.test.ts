import { describe, expect, it, vi } from 'vitest';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SelectionMode } from '@/types/selection_mode.js';
import {
  COORDINATOR_FACE_MODE_ENTER_GUIDANCE,
  coordinatorFaceModeEnterGuidanceShow,
  coordinatorFaceModeStatusWrite,
} from '@/tools/face/coordinator_face_mode_status.js';

describe('coordinatorFaceModeStatus', () => {
  it('clears object selection, refreshes meshes and shows face-mode guidance', () => {
    const selectionManager = new ManagerSelection();
    const updateFaceSelectionMeshes = vi.fn();
    const showStatusMessage = vi.fn();
    coordinatorFaceModeEnterGuidanceShow(selectionManager, updateFaceSelectionMeshes, showStatusMessage);
    expect(updateFaceSelectionMeshes).toHaveBeenCalledTimes(1);
    expect(showStatusMessage).toHaveBeenCalledWith(COORDINATOR_FACE_MODE_ENTER_GUIDANCE);
  });

  it('writes the status bar when the face count changes and skips an unchanged count', () => {
    const setSelectionModeInfo = vi.fn();
    const statusBar = { setSelectionModeInfo } as never;
    expect(coordinatorFaceModeStatusWrite(statusBar, SelectionMode.FACE, 2, -1, false)).toBe(2);
    expect(coordinatorFaceModeStatusWrite(statusBar, SelectionMode.FACE, 2, 2, false)).toBe(2);
    expect(coordinatorFaceModeStatusWrite(statusBar, SelectionMode.FACE, 2, 2, true)).toBe(2);
    expect(coordinatorFaceModeStatusWrite(null, SelectionMode.FACE, 4, 2, true)).toBe(2);
    expect(setSelectionModeInfo.mock.calls).toEqual([
      ['Face', 2],
      ['Face', 2],
    ]);
  });
});
