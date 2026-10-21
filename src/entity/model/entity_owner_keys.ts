import type * as THREE from 'three';

/** Editor-only scene object kinds that are owned by a flagged group. */
export type EntityKind = 'light' | 'room' | 'portal';

/** UserData key holding the kind of an entity owner group. */
export const ENTITY_KIND_USERDATA_KEY = 'entityKind';

/** UserData key holding the owner's settings object. */
export const ENTITY_SETTINGS_USERDATA_KEY = 'entitySettings';

/** UserData flag on every editor-only visual child of an entity owner. */
export const ENTITY_VISUAL_PART_USERDATA_KEY = 'isEntityVisualPart';

/** UserData flag on the clickable marker mesh of an entity owner. */
export const ENTITY_PICK_MESH_USERDATA_KEY = 'isEntityPickMesh';

/** Every kind an owner may carry. */
const ENTITY_KINDS: readonly EntityKind[] = ['light', 'room', 'portal'];

/**
 * Returns the entity kind stored on an object.
 *
 * @param object Candidate object.
 * @returns The kind, or null when the object is not an entity owner.
 */
export function entityKindRead(object: THREE.Object3D): EntityKind | null {
  const stored: unknown = object.userData[ENTITY_KIND_USERDATA_KEY];
  return ENTITY_KINDS.find((kind) => kind === stored) ?? null;
}

/**
 * Returns whether the object is the owner group of any entity.
 *
 * @param object Candidate object.
 * @returns True for entity owners.
 */
export function entityOwnerIs(object: THREE.Object3D): boolean {
  return entityKindRead(object) !== null;
}

/**
 * Returns whether the object is an editor-only visual of an entity.
 *
 * @param object Candidate object.
 * @returns True for entity visual parts, including pick markers.
 */
export function entityVisualPartIs(object: THREE.Object3D): boolean {
  return object.userData[ENTITY_VISUAL_PART_USERDATA_KEY] === true;
}

/**
 * Returns whether the object is the clickable marker of an entity.
 *
 * @param object Candidate object.
 * @returns True for entity pick meshes.
 */
export function entityPickMeshIs(object: THREE.Object3D): boolean {
  return object.userData[ENTITY_PICK_MESH_USERDATA_KEY] === true;
}

/**
 * Returns the nearest entity owner at or above an object.
 *
 * @param object Visual part or any object.
 * @returns The owning entity group, or null when there is none.
 */
export function entityOwnerOfPart(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (entityOwnerIs(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}
