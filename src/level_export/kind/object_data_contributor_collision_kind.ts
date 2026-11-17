import type * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';

/**
 * Carries the collision kind an object overrides through scene files and
 * duplicates.
 */
export class ObjectDataContributorCollisionKind extends ObjectDataContributor {
  readonly contributorName = 'collision_kind';

  /**
   * Stores an object's overridden collision kind in its scene entry.
   *
   * @param object Live scene object.
   * @param entry Entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    const kind = CollisionKindStore.overrideRead(object);
    if (kind !== null) {
      entry.collisionKind = kind;
    }
  }

  /**
   * Restores an object's overridden collision kind from its scene entry.
   *
   * @param entry Entry being read.
   * @param object Object just created from the entry.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    CollisionKindStore.overrideWrite(object, CollisionKindStore.fromUnknown(entry.collisionKind));
  }

  /**
   * Gives a duplicate the source's overridden collision kind.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    CollisionKindStore.overrideWrite(copy, CollisionKindStore.overrideRead(source));
  }
}
