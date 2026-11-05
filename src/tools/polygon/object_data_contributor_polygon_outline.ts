import type * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import {
  polygonOutlineRecipeRead,
  polygonOutlineRecipeWrite,
  USERDATA_POLYGON_OUTLINE_KEY,
} from './polygon_outline_recipe.js';

/**
 * Carries re-editable 2D Polygon extrusion recipes (`broomPolygonOutline`)
 * through scene file persistence and object duplication.
 */
export class ObjectDataContributorPolygonOutline extends ObjectDataContributor {
  readonly contributorName = 'polygon_outline';

  /**
   * Writes an object's own polygon outline recipe into its scene entry.
   *
   * @param object Live scene object.
   * @param entry Scene entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    if (object.userData?.[USERDATA_POLYGON_OUTLINE_KEY]) {
      const recipe = polygonOutlineRecipeRead(object);
      if (recipe) {
        entry.polygonOutline = recipe;
      }
    }
  }

  /**
   * Restores an object's polygon outline recipe from its scene entry.
   *
   * @param entry Scene entry being read.
   * @param object Created scene object.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    if (entry.polygonOutline) {
      polygonOutlineRecipeWrite(object, entry.polygonOutline);
    }
  }

  /**
   * Copies an object's polygon outline recipe onto a duplicated object.
   *
   * @param source Source object.
   * @param copy Duplicated object.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    if (source.userData?.[USERDATA_POLYGON_OUTLINE_KEY]) {
      const recipe = polygonOutlineRecipeRead(source);
      if (recipe) {
        polygonOutlineRecipeWrite(copy, recipe);
      }
    }
  }
}
