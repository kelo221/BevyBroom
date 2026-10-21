import type * as THREE from 'three';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';
import { entityOwnersBuiltinList } from '@/entity/registry/entity_owner_registry_builtin.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Finds the owner helper of every entity kind: the kinds the editor ships with
 * and kinds features register at runtime. The first helper of a kind wins.
 */
export class EntityOwnerRegistry {
  private static readonly owners = new RegistryExtensible<EntityOwner<object>>(entityOwnersBuiltinList);

  /**
   * Adds the owner helper of a new kind. A helper for an already registered
   * kind is ignored.
   *
   * @param entityOwner Owner helper.
   */
  static register(entityOwner: EntityOwner<object>): void {
    if (EntityOwnerRegistry.findByKind(entityOwner.kind) !== null) {
      return;
    }
    EntityOwnerRegistry.owners.register(entityOwner);
  }

  /**
   * Returns the owner helper matching an entity owner's kind.
   *
   * @param object Candidate entity owner.
   * @returns The owner helper, or null when the object is not an entity owner.
   */
  static find(object: THREE.Object3D): EntityOwner<object> | null {
    const kind = entityKindRead(object);
    return kind === null ? null : EntityOwnerRegistry.findByKind(kind);
  }

  /**
   * Returns the owner helper of a kind name, such as a scene file entry type.
   *
   * @param kind Candidate kind name.
   * @returns The owner helper, or null when no entity kind has that name.
   */
  static findByKind(kind: string): EntityOwner<object> | null {
    return EntityOwnerRegistry.owners.list().find((entityOwner) => entityOwner.kind === kind) ?? null;
  }
}
