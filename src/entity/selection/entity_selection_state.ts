import type * as THREE from 'three';

/** UserData flag on visual parts drawn only while their owner is selected. */
export const ENTITY_VISUAL_SELECTED_ONLY_USERDATA_KEY = 'isEntityVisualSelectedOnly';

/**
 * Entity owners that are currently selected; kept outside userData so it is
 * never saved.
 */
const entitySelectedOwners = new WeakSet<THREE.Object3D>();

/**
 * Returns whether an entity owner is currently selected.
 *
 * @param owner Entity owner group.
 * @returns True while the owner or its marker is selected.
 */
export function entitySelectedIs(owner: THREE.Object3D): boolean {
  return entitySelectedOwners.has(owner);
}

/**
 * Records whether an entity owner is selected and shows or hides its
 * selection-only parts to match.
 *
 * @param owner Entity owner group.
 * @param isSelected Whether the owner is selected.
 */
export function entitySelectedSet(owner: THREE.Object3D, isSelected: boolean): void {
  if (isSelected) {
    entitySelectedOwners.add(owner);
  } else {
    entitySelectedOwners.delete(owner);
  }
  for (const child of owner.children) {
    if (entitySelectedOnlyIs(child)) {
      child.visible = isSelected;
    }
  }
}

/**
 * Makes a visual part of an owner draw only while the owner is selected and
 * shows it now when the owner already is.
 *
 * @param part Visual part, a direct child of the owner.
 * @param owner Entity owner group.
 */
export function entitySelectedOnlyFlag(part: THREE.Object3D, owner: THREE.Object3D): void {
  part.userData[ENTITY_VISUAL_SELECTED_ONLY_USERDATA_KEY] = true;
  part.visible = entitySelectedIs(owner);
}

/**
 * Returns whether a visual part draws only while its owner is selected.
 *
 * @param part Candidate part.
 * @returns True for selection-only parts.
 */
export function entitySelectedOnlyIs(part: THREE.Object3D): boolean {
  return part.userData[ENTITY_VISUAL_SELECTED_ONLY_USERDATA_KEY] === true;
}
