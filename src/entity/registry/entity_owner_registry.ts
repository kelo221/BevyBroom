import type * as THREE from 'three';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

/** Owner helpers of every entity kind the editor authors. */
const ENTITY_OWNERS: readonly EntityOwner<object>[] = [LightOwner, RoomOwner, PortalOwner];

/**
 * Returns the owner helper matching an entity owner's kind.
 *
 * @param object Candidate entity owner.
 * @returns The owner helper, or null when the object is not an entity owner.
 */
export function entityOwnerRegistryFind(object: THREE.Object3D): EntityOwner<object> | null {
  const kind = entityKindRead(object);
  return kind === null ? null : entityOwnerRegistryFindByKind(kind);
}

/**
 * Returns the owner helper of a kind name, such as a scene file entry type.
 *
 * @param kind Candidate kind name.
 * @returns The owner helper, or null when no entity kind has that name.
 */
export function entityOwnerRegistryFindByKind(kind: string): EntityOwner<object> | null {
  return ENTITY_OWNERS.find((entityOwner) => entityOwner.kind === kind) ?? null;
}
