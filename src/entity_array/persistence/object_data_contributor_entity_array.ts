import type * as THREE from 'three';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArraySettingsRules } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';

/**
 * Carries array settings and the marks of array copies through scene files,
 * copy and paste and duplication. Both are editor-only: the game receives the
 * copies as ordinary entities and never the settings or marks.
 */
export class ObjectDataContributorEntityArray extends ObjectDataContributor {
  readonly contributorName = 'entity_array';

  /**
   * Writes an object's array settings and copy mark into its scene entry.
   *
   * @param object Live scene object.
   * @param entry Scene entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    const settings = EntityArrayStore.read(object);
    if (settings !== null) {
      entry.entityArray = EntityArraySettingsRules.toFieldValues(settings);
    }
    const mark = EntityArrayCopyMark.read(object);
    if (mark !== null) {
      entry.entityArrayCopy = { cell: [...mark.cell], signature: mark.signature };
    }
  }

  /**
   * Restores an object's array settings and copy mark from its scene entry.
   *
   * @param entry Scene entry being read.
   * @param object Created scene object.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    const settings = EntityArraySettingsRules.fromUnknown(entry.entityArray);
    if (settings !== null) {
      EntityArrayStore.write(object, settings);
    }
    const mark = EntityArrayCopyMark.fromUnknown(entry.entityArrayCopy);
    if (mark !== null) {
      EntityArrayCopyMark.write(object, mark);
    }
  }

  /**
   * Gives a duplicate the array settings and copy mark of its source.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    const settings = EntityArrayStore.read(source);
    if (settings !== null) {
      EntityArrayStore.write(copy, settings);
    }
    const mark = EntityArrayCopyMark.read(source);
    if (mark !== null) {
      EntityArrayCopyMark.write(copy, mark);
    }
  }
}
