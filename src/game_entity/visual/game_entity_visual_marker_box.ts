import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Picks the box a game entity's marker is drawn as from the classes of its
 * components: the box chosen by the class's marker box field, otherwise the
 * class's own marker box. When several classes give a box, one that names a
 * model wins.
 */
export class GameEntityVisualMarkerBox {
  /**
   * Returns the marker box of an object's components.
   *
   * @param owner Object carrying game components.
   * @returns The first box, in type path order of the attached known classes,
   *   that names a model; otherwise the first box; null when no class declares
   *   one.
   */
  static boxOf(owner: THREE.Object3D): GameEntityMarkerBox | null {
    const markerBoxes = GameEntityVisualMarkerBox.boxesOf(owner);
    return markerBoxes.find((markerBox) => markerBox.model !== undefined) ?? markerBoxes[0] ?? null;
  }

  /**
   * Returns the marker boxes the attached known classes give an object.
   *
   * @param owner Object carrying game components.
   * @returns One box per class that declares one, in type path order.
   */
  private static boxesOf(owner: THREE.Object3D): GameEntityMarkerBox[] {
    const components = GameEntityComponentStore.read(owner);
    return Object.keys(components)
      .sort()
      .map((typePath) => GameEntityClassRegistry.classFind(typePath))
      .map((gameClass) => (gameClass === null ? null : GameEntityVisualMarkerBox.classBoxOf(gameClass, components)))
      .filter((markerBox): markerBox is GameEntityMarkerBox => markerBox !== null);
  }

  /**
   * Returns the marker box one class gives an object.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns Box picked by the field value, otherwise the class box, or null.
   */
  static classBoxOf(gameClass: GameEntityClass, components: GameEntityComponents): GameEntityMarkerBox | null {
    const fieldValueText = GameEntityVisualMarkerBox.fieldValueTextOf(gameClass, components);
    const pickedBox = fieldValueText === null ? undefined : gameClass.marker_boxes?.[fieldValueText];
    return pickedBox ?? gameClass.marker_box ?? null;
  }

  /**
   * Returns the effective value of a class's marker box field as text.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns Value text, or null when the class names no field, the field is
   *   unknown or its value is not text, a number or a boolean.
   */
  static fieldValueTextOf(gameClass: GameEntityClass, components: GameEntityComponents): string | null {
    const fieldPath = gameClass.marker_box_field;
    const field = fieldPath === undefined ? null : GameEntityComponentResolver.fieldFind(gameClass, fieldPath);
    if (field === null) {
      return null;
    }
    return GameEntityVisualMarkerBox.valueText(
      GameEntityComponentResolver.valueEffective(components, gameClass.type_path, field),
    );
  }

  /**
   * Returns a scalar field value as text.
   *
   * @param value Field value.
   * @returns Text form, or null for values that are not scalars.
   */
  private static valueText(value: PreviewFieldValue): string | null {
    const isScalar = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    return isScalar ? String(value) : null;
  }
}
