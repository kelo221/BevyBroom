import type * as THREE from 'three';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';

/**
 * Returns whether the object is the owner group of an authored light.
 *
 * @param object Candidate object.
 * @returns True for light owners.
 */
export function isLightOwner(object: THREE.Object3D): boolean {
  return entityKindRead(object) === 'light';
}
