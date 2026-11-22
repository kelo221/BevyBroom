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

/**
 * UserData flag on an entity marker that stands for the space its entity fills,
 * such as a store fixture's box, so placed content may rest on it.
 */
export const ENTITY_MARKER_SOLID_USERDATA_KEY = 'isEntityMarkerSolid';

/** UserData flag on visual parts that keep their identity across refreshes. */
export const ENTITY_VISUAL_PERSISTENT_USERDATA_KEY = 'isEntityVisualPersistent';

/**
 * UserData flag on an entity owner whose markers, and the markers of every
 * entity owner nested under it, cannot be clicked, such as a generated copy
 * that is edited through its source.
 */
export const ENTITY_PICK_DISABLED_USERDATA_KEY = 'isEntityPickDisabled';

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
 * Returns the entity owners nested directly under an entity owner, such as the
 * light a store fixture carries.
 *
 * @param owner Entity owner.
 * @returns Child entity owners in child order; its visuals are left out.
 */
export function entityOwnerChildOwners(owner: THREE.Object3D): THREE.Object3D[] {
  return owner.children.filter((child) => entityOwnerIs(child));
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
 * Turns clicking an entity owner's markers off or back on.
 *
 * @param owner Entity owner.
 * @param isDisabled True to keep its markers from being clicked.
 */
export function entityPickDisabledSet(owner: THREE.Object3D, isDisabled: boolean): void {
  if (isDisabled) {
    owner.userData[ENTITY_PICK_DISABLED_USERDATA_KEY] = true;
  } else {
    delete owner.userData[ENTITY_PICK_DISABLED_USERDATA_KEY];
  }
}

/**
 * Returns whether an object is an entity marker the user may click: a pick mesh
 * none of whose owners turned clicking off.
 *
 * @param object Candidate object.
 * @returns True for clickable entity pick meshes.
 */
export function entityPickMeshSelectableIs(object: THREE.Object3D): boolean {
  if (!entityPickMeshIs(object)) {
    return false;
  }
  let current: THREE.Object3D | null = object.parent;
  while (current) {
    if (current.userData[ENTITY_PICK_DISABLED_USERDATA_KEY] === true) {
      return false;
    }
    current = current.parent;
  }
  return true;
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
