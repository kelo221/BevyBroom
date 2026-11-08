import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { faceModeStatusLabelSelectionMode } from './face_mode_status_labels.js';

/** Face-mode guidance shown when Face Select becomes active. */
export const COORDINATOR_FACE_MODE_ENTER_GUIDANCE =
  'Face mode: drag to select · drag selected face to slide UVs · G/R/S UV transform · hold M to smear · Extrude / Shift+E';

/**
 * Clears object selection, refreshes face-pickable meshes, and shows face-mode
 * guidance.
 *
 * @param selectionManager Object selection to clear.
 * @param updateFaceSelectionMeshes Refreshes face-pickable meshes.
 * @param showStatusMessage Shows the face-mode guidance string.
 */
export function coordinatorFaceModeEnterGuidanceShow(
  selectionManager: ManagerSelection,
  updateFaceSelectionMeshes: () => void,
  showStatusMessage: (message: string) => void,
): void {
  selectionManager.clearSelection();
  updateFaceSelectionMeshes();
  showStatusMessage(COORDINATOR_FACE_MODE_ENTER_GUIDANCE);
}

/**
 * Writes the status bar selection-mode line when the face count or mode
 * changed.
 *
 * @param statusBar Status bar to write, or null.
 * @param mode Current selection mode.
 * @param count Selected face count.
 * @param lastCount Last written face count.
 * @param force When true, writes even if the face count is unchanged.
 * @returns Face count stored after this write.
 */
export function coordinatorFaceModeStatusWrite(
  statusBar: StatusBar | null,
  mode: SelectionMode,
  count: number,
  lastCount: number,
  force: boolean,
): number {
  if (!statusBar) {
    return lastCount;
  }
  if (!force && mode === SelectionMode.FACE && count === lastCount) {
    return lastCount;
  }
  statusBar.setSelectionModeInfo(faceModeStatusLabelSelectionMode(mode), count);
  return count;
}
