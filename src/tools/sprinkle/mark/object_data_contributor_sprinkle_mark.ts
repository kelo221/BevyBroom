import type * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { SprinkleMark } from './sprinkle_mark.js';

/**
 * Carries the Sprinkle tool's mark through scene files, copy and paste and
 * duplication. The mark is editor-only: it is never sent to the game preview or
 * written into exported files.
 */
export class ObjectDataContributorSprinkleMark extends ObjectDataContributor {
  readonly contributorName = 'sprinkle_mark';

  /**
   * Writes an object's sprinkle definition name into its scene entry.
   *
   * @param object Live scene object.
   * @param entry Scene entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    const definitionName = SprinkleMark.read(object);
    if (definitionName !== null) {
      entry.sprinkleDefinition = definitionName;
    }
  }

  /**
   * Restores an object's sprinkle mark from its scene entry.
   *
   * @param entry Scene entry being read.
   * @param object Created scene object.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    if (typeof entry.sprinkleDefinition === 'string') {
      SprinkleMark.write(object, entry.sprinkleDefinition);
    }
  }

  /**
   * Gives a duplicate the sprinkle mark of its source.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    const definitionName = SprinkleMark.read(source);
    if (definitionName !== null) {
      SprinkleMark.write(copy, definitionName);
    }
  }
}
