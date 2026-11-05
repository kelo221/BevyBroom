import type * as THREE from 'three';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SelectionMode } from '@/types/selection_mode.js';
import type { UvTransformMode } from '@/texture/interactive/uv_transform_mode.js';

/**
 * Builds a status label describing extrude products (meshes and/or brushes).
 *
 * @param createdMeshes Selectable meshes to describe in the label.
 * @returns Human-readable status string.
 */
export function faceModeStatusLabelExtrude(createdMeshes: readonly THREE.Mesh[]): string {
  const onlyMesh = createdMeshes.length === 1 ? createdMeshes[0] : undefined;
  if (onlyMesh) {
    const kind = SolidBrushVisual.isBrushObject(onlyMesh) ? 'brush' : 'mesh';
    return `Created ${kind} ${onlyMesh.name}`;
  }
  const brushCount = createdMeshes.filter((mesh) => SolidBrushVisual.isBrushObject(mesh)).length;
  const meshCount = createdMeshes.length - brushCount;
  if (brushCount > 0 && meshCount > 0) {
    return `Created ${brushCount} brush(es) and ${meshCount} mesh(es)`;
  }
  if (brushCount > 0) {
    return `Created ${brushCount} brush(es)`;
  }
  return `Created ${createdMeshes.length} convex solids`;
}

/**
 * Converts a selection mode enum value to its display string.
 *
 * @param mode The selection mode to format.
 * @returns The display name of the selection mode.
 */
export function faceModeStatusLabelSelectionMode(mode: SelectionMode): string {
  return mode === SelectionMode.FACE ? 'Face' : 'Object';
}

/**
 * Builds a short status string for a single-use UV transform mode.
 *
 * @param mode Transform mode.
 * @returns Status text.
 */
export function faceModeStatusLabelUvTransform(mode: UvTransformMode): string {
  if (mode === 'move') {
    return 'UV Move (single-use) — move mouse, click or Enter to confirm, Esc to cancel';
  }
  if (mode === 'rotate') {
    return 'UV Rotate (single-use) — drag away from pivot first, then orbit; click to confirm';
  }
  return 'UV Scale (single-use) — drag away from pivot first, then in/out; click to confirm';
}
