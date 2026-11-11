import type { Object3D } from 'three';

/**
 * Identifies modifier volumes from their userData flag alone, without loading
 * the stack catalog.
 *
 * @param object Candidate.
 * @returns True when the object is flagged as a modifier volume.
 */
export function modifierVolumeIs(object: Object3D): boolean {
  return object.userData['isModifierVolume'] === true;
}
