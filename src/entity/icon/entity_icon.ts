import type * as THREE from 'three';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Icon of one entity owner and the color it is drawn in. */
export interface EntityIcon {
  readonly iconName: IconName;
  readonly colorHex: number;
}

/**
 * Returns the icon and icon color an entity owner's kind chooses for its
 * current settings.
 *
 * @param object Candidate entity owner.
 * @returns The icon, or null when the object is not an entity owner.
 */
export function entityIconOf(object: THREE.Object3D): EntityIcon | null {
  const entityOwner = EntityOwnerRegistry.find(object);
  const settings = entityOwner?.settingsRead(object) ?? null;
  if (!entityOwner || settings === null) {
    return null;
  }
  const definition = entityOwner.definition;
  return { iconName: definition.iconName(settings), colorHex: definition.iconColorHex(object, settings) };
}
