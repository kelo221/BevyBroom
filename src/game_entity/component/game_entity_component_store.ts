import type * as THREE from 'three';
import type {
  PreviewAuthoredComponents,
  PreviewComponentFields,
} from '@/preview/protocol/preview_protocol_placeable_types.js';
import { gameEntityFieldValueFromUnknown } from '@/game_entity/component/game_entity_component_value.js';
import { gameEntityRecordIs } from '@/game_entity/class/game_entity_class_schema.js';

/** Component overrides of one object: type path to field path to value. */
export type GameEntityComponents = PreviewAuthoredComponents;

/** UserData key holding the component overrides of an object. */
export const GAME_ENTITY_COMPONENTS_USERDATA_KEY = 'gameComponents';

/**
 * Reads and writes the game component overrides stored on any scene object.
 * Only overridden fields are stored; classes and fields the game does not know
 * are kept as they are.
 */
export class GameEntityComponentStore {
  /**
   * Returns an independent copy of an object's component overrides.
   *
   * @param object Scene object.
   * @returns Overrides by component type path; empty when there are none.
   */
  static read(object: THREE.Object3D): GameEntityComponents {
    return GameEntityComponentStore.fromUnknown(object.userData[GAME_ENTITY_COMPONENTS_USERDATA_KEY]);
  }

  /**
   * Stores a copy of the overrides, removing the key when there are none.
   *
   * @param object Scene object.
   * @param components Overrides by component type path.
   */
  static write(object: THREE.Object3D, components: GameEntityComponents): void {
    const sanitized = GameEntityComponentStore.fromUnknown(components);
    if (Object.keys(sanitized).length === 0) {
      delete object.userData[GAME_ENTITY_COMPONENTS_USERDATA_KEY];
      return;
    }
    object.userData[GAME_ENTITY_COMPONENTS_USERDATA_KEY] = sanitized;
  }

  /**
   * Returns whether an object carries any component.
   *
   * @param object Scene object.
   * @returns True when at least one component is attached.
   */
  static hasAny(object: THREE.Object3D): boolean {
    return Object.keys(GameEntityComponentStore.read(object)).length > 0;
  }

  /**
   * Reads untrusted data into component overrides, dropping values that cannot
   * travel to the game.
   *
   * @param value Any value.
   * @returns Independent overrides; empty when the value is not a record.
   */
  static fromUnknown(value: unknown): GameEntityComponents {
    const components: GameEntityComponents = {};
    if (!gameEntityRecordIs(value)) {
      return components;
    }
    for (const [typePath, fields] of Object.entries(value)) {
      if (typePath.trim() !== '' && gameEntityRecordIs(fields)) {
        components[typePath] = GameEntityComponentStore.fieldsFromUnknown(fields);
      }
    }
    return components;
  }

  /**
   * Reads the overrides of one component.
   *
   * @param fields Untrusted field record.
   * @returns Valid overrides by field path; empty when the value is not a
   *   record.
   */
  static fieldsFromUnknown(fields: unknown): PreviewComponentFields {
    const copied: PreviewComponentFields = {};
    if (!gameEntityRecordIs(fields)) {
      return copied;
    }
    for (const [path, value] of Object.entries(fields)) {
      const fieldValue = gameEntityFieldValueFromUnknown(value);
      if (path.trim() !== '' && fieldValue !== undefined) {
        copied[path] = fieldValue;
      }
    }
    return copied;
  }
}
