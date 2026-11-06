import type * as THREE from 'three';
import { SelectionMode } from '@/types/selection_mode.js';
import type { ControllerFaceExtrusion } from './controller_face_extrusion.js';
import { faceModeStatusLabelExtrude } from './face_mode_status_labels.js';

/** Status and world-refresh callbacks used while extruding faces. */
export interface CoordinatorFaceModeExtrudeHost {
  showStatusMessage(message: string): void;
  syncPrimitivesToViewports(): void;
  updateFaceSelectionMeshes(): void;
  updateShadingMeshes(): void;
  refreshOutliner(): void;
  setSelection(createdMeshes: THREE.Mesh[]): void;
  updateSelectionModeStatus(): void;
}

/**
 * Enters face selection when it is not already active.
 *
 * @param controller Face extrusion controller.
 * @param host Status and world-refresh callbacks.
 * @returns True when face selection is already active.
 */
export function faceModeEnsureFaceSelectionActive(
  controller: ControllerFaceExtrusion,
  host: CoordinatorFaceModeExtrudeHost,
): boolean {
  if (controller.getSelectionMode() === SelectionMode.FACE) {
    return true;
  }
  controller.setSelectionMode(SelectionMode.FACE);
  host.showStatusMessage('Face mode: drag faces to select, G/R/S for UVs, Extrude (Shift+E)');
  return false;
}

/**
 * Reports when no faces are selected for extrusion.
 *
 * @param controller Face extrusion controller.
 * @param host Status and world-refresh callbacks.
 * @returns True when at least one face is selected.
 */
export function faceModeEnsureFacesSelected(
  controller: ControllerFaceExtrusion,
  host: CoordinatorFaceModeExtrudeHost,
): boolean {
  if (controller.getSelectedFaceCount() > 0) {
    return true;
  }
  host.showStatusMessage('Select a face first, then Extrude (Shift+E)');
  return false;
}

/**
 * Extrudes the selected faces and selects the created meshes.
 *
 * @param controller Face extrusion controller.
 * @param host Status and world-refresh callbacks.
 */
export function faceModeExtrudeSelectedFacesApply(
  controller: ControllerFaceExtrusion,
  host: CoordinatorFaceModeExtrudeHost,
): void {
  const createdMeshes = controller.extrudeSelectedFacesByDefaultDistance();
  if (createdMeshes.length === 0) {
    host.showStatusMessage('Extrude failed — select one or more faces');
    return;
  }
  faceModeExtrudeCreatedMeshesSelect(controller, host, createdMeshes);
}

/**
 * Selects the meshes created by a successful face extrude.
 *
 * @param controller Face extrusion controller.
 * @param host Status and world-refresh callbacks.
 * @param createdMeshes Meshes created by the extrude.
 */
function faceModeExtrudeCreatedMeshesSelect(
  controller: ControllerFaceExtrusion,
  host: CoordinatorFaceModeExtrudeHost,
  createdMeshes: THREE.Mesh[],
): void {
  controller.setSelectionMode(SelectionMode.OBJECT);
  host.syncPrimitivesToViewports();
  host.updateFaceSelectionMeshes();
  host.updateShadingMeshes();
  host.refreshOutliner();
  host.setSelection(createdMeshes);
  host.updateSelectionModeStatus();
  host.showStatusMessage(faceModeStatusLabelExtrude(createdMeshes));
}
