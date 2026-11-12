import type * as THREE from 'three';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';

/**
 * Returns whether an Object Properties tab applies to a selection made only of
 * modifier volumes.
 *
 * @param selectedObjects Edited objects.
 * @returns True when the selection is not empty and every object is a volume.
 */
export function objectPropertiesTabAppliesToVolumesIs(selectedObjects: readonly THREE.Object3D[]): boolean {
  return selectedObjects.length > 0 && selectedObjects.every((object) => ModifierVolume.isVolume(object));
}

/**
 * Returns whether an Object Properties tab applies to a selection that holds no
 * modifier volume.
 *
 * @param selectedObjects Edited objects.
 * @returns True when no selected object is a volume.
 */
export function objectPropertiesTabAppliesToNonVolumesIs(selectedObjects: readonly THREE.Object3D[]): boolean {
  return !selectedObjects.some((object) => ModifierVolume.isVolume(object));
}
