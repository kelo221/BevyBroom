import type * as THREE from 'three';
import { type EntityArraySettings, EntityArraySettingsRules } from './entity_array_settings.js';

/** UserData key holding the array settings of an entity that repeats. */
export const ENTITY_ARRAY_USERDATA_KEY = 'entityArray';

/** Reads and writes the array settings an entity owner carries. */
export class EntityArrayStore {
  /**
   * Returns the array settings of an object.
   *
   * @param object Candidate entity owner.
   * @returns Valid settings, or null when the object does not repeat.
   */
  static read(object: THREE.Object3D): EntityArraySettings | null {
    const stored: unknown = object.userData[ENTITY_ARRAY_USERDATA_KEY];
    return stored === undefined ? null : EntityArraySettingsRules.fromUnknown(stored);
  }

  /**
   * Gives an object array settings or takes them away.
   *
   * @param object Entity owner.
   * @param settings Settings to store, or null to stop repeating.
   */
  static write(object: THREE.Object3D, settings: EntityArraySettings | null): void {
    if (settings === null) {
      delete object.userData[ENTITY_ARRAY_USERDATA_KEY];
      return;
    }
    object.userData[ENTITY_ARRAY_USERDATA_KEY] = EntityArraySettingsRules.toFieldValues(settings);
  }

  /**
   * Returns every object under a root that carries array settings, the root
   * included.
   *
   * @param root Scene root.
   * @returns Array sources in traversal order.
   */
  static sourcesUnder(root: THREE.Object3D): THREE.Object3D[] {
    const sources: THREE.Object3D[] = [];
    root.traverse((object) => {
      if (object.userData[ENTITY_ARRAY_USERDATA_KEY] !== undefined) {
        sources.push(object);
      }
    });
    return sources;
  }
}
