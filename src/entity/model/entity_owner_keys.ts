import type * as THREE from 'three';

/**
 * Name of an entity kind, such as `light`, `room`, `portal` or `game_entity`.
 * Kinds become known when an owner helper of that kind is created.
 */
export type EntityKind = string;

/** UserData key holding the kind of an entity owner group. */
export const ENTITY_KIND_USERDATA_KEY = 'entityKind';

/** UserData key holding the owner's settings object. */
export const ENTITY_SETTINGS_USERDATA_KEY = 'entitySettings';

/** UserData flag on every editor-only visual child of an entity owner. */
export const ENTITY_VISUAL_PART_USERDATA_KEY = 'isEntityVisualPart';

/** UserData flag on the clickable marker mesh of an entity owner. */
export const ENTITY_PICK_MESH_USERDATA_KEY = 'isEntityPickMesh';

/** UserData flag on visual parts that keep their identity across refreshes. */
export const ENTITY_VISUAL_PERSISTENT_USERDATA_KEY = 'isEntityVisualPersistent';

/** Every kind an owner helper exists for. */
const ENTITY_KINDS_KNOWN = new Set<EntityKind>();

/**
 * Makes a kind known so objects stamped with it are recognized as owners.
 *
 * @param kind Kind name.
 */
export function entityKindRegister(kind: EntityKind): void {
  ENTITY_KINDS_KNOWN.add(kind);
}

/**
 * Returns the entity kind stored on an object.
 *
 * @param object Candidate object.
 * @returns The kind, or null when the object is not an owner of a known kind.
 */
export function entityKindRead(object: THREE.Object3D): EntityKind | null {
  const stored: unknown = object.userData[ENTITY_KIND_USERDATA_KEY];
  return typeof stored === 'string' && ENTITY_KINDS_KNOWN.has(stored) ? stored : null;
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
 * Returns whether the object is a visual part kept across refreshes, such as
 * the marker or its icon.
 *
 * @param object Candidate object.
 * @returns True for persistent visual parts.
 */
export function entityVisualPersistentIs(object: THREE.Object3D): boolean {
  return object.userData[ENTITY_VISUAL_PERSISTENT_USERDATA_KEY] === true;
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
