import type * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { GameEntityFixtureLightMark } from './game_entity_fixture_light_mark.js';

/**
 * Carries the mark of lights made from an entity's variant through scene files,
 * copy and paste and duplication. The mark is editor-only: it is never sent to
 * the game preview or written into exported files.
 */
export class ObjectDataContributorFixtureLightMark extends ObjectDataContributor {
  readonly contributorName = 'fixture_light_mark';

  /**
   * Writes the variant key a light was made from into its scene entry.
   *
   * @param object Live scene object.
   * @param entry Scene entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    const variantKey = GameEntityFixtureLightMark.read(object);
    if (variantKey !== null) {
      entry.fixtureLightOf = variantKey;
    }
  }

  /**
   * Restores a light's mark from its scene entry.
   *
   * @param entry Scene entry being read.
   * @param object Created scene object.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    if (typeof entry.fixtureLightOf === 'string') {
      GameEntityFixtureLightMark.write(object, entry.fixtureLightOf);
    }
  }

  /**
   * Gives a duplicate the mark of its source.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    const variantKey = GameEntityFixtureLightMark.read(source);
    if (variantKey !== null) {
      GameEntityFixtureLightMark.write(copy, variantKey);
    }
  }
}
