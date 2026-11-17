import type * as THREE from 'three';
import { COLLISION_KINDS, type CollisionKind } from '@/level_export/collision/collision_types.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';

/** UserData key holding the collision kind an object overrides. */
export const COLLISION_KIND_USERDATA_KEY = 'collisionKind';

/**
 * Collision kind of objects that neither override one nor carry a class
 * declaring one.
 */
export const COLLISION_KIND_DEFAULT: CollisionKind = 'solid';

/**
 * Stores and resolves the collision kind of objects: the kind an object
 * overrides, else the kind the first of its game component classes declares,
 * else solid.
 */
export class CollisionKindStore {
  /**
   * Returns the collision kind an object overrides.
   *
   * @param object Scene object.
   * @returns Overridden kind, or null when it takes the declared one.
   */
  static overrideRead(object: THREE.Object3D): CollisionKind | null {
    return CollisionKindStore.fromUnknown(object.userData[COLLISION_KIND_USERDATA_KEY]);
  }

  /**
   * Sets or clears the collision kind an object overrides.
   *
   * @param object Scene object.
   * @param kind Kind to override with, or null to take the declared one.
   */
  static overrideWrite(object: THREE.Object3D, kind: CollisionKind | null): void {
    if (kind === null) {
      delete object.userData[COLLISION_KIND_USERDATA_KEY];
      return;
    }
    object.userData[COLLISION_KIND_USERDATA_KEY] = kind;
  }

  /**
   * Returns the kind the game component classes of an object declare.
   *
   * @param object Scene object.
   * @returns The first declared kind, or null when no class declares one.
   */
  static declaredRead(object: THREE.Object3D): CollisionKind | null {
    for (const typePath of Object.keys(GameEntityComponentStore.read(object))) {
      const declared = GameEntityClassRegistry.classFind(typePath)?.collision;
      if (declared !== undefined) {
        return declared;
      }
    }
    return null;
  }

  /**
   * Returns the collision kind an object takes.
   *
   * @param object Scene object.
   * @returns Override, else declared kind, else solid.
   */
  static resolve(object: THREE.Object3D): CollisionKind {
    return CollisionKindStore.overrideRead(object) ?? CollisionKindStore.declaredRead(object) ?? COLLISION_KIND_DEFAULT;
  }

  /**
   * Reads an untrusted value as a collision kind.
   *
   * @param value Any value.
   * @returns The kind, or null when the value names none.
   */
  static fromUnknown(value: unknown): CollisionKind | null {
    return COLLISION_KINDS.find((kind) => kind === value) ?? null;
  }
}
