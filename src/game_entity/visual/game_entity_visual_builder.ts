import * as THREE from 'three';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Marker color of game entities whose classes the editor does not know. */
export const GAME_ENTITY_UNKNOWN_COLOR = 0x808080;

/** Icon every game entity shows. */
export const GAME_ENTITY_ICON_NAME: IconName = 'puzzle';

/** UserData key on the marker holding the state its tint was computed from. */
const GAME_ENTITY_MARKER_TINT_KEY = 'gameEntityTintKey';

/**
 * Builds the editor-only marker of a game entity: a box with a camera-facing
 * icon, tinted with the marker color of its first known component class. The
 * tint follows class and component changes when the marker is next drawn.
 */
export class GameEntityVisualBuilder {
  /**
   * Ensures the marker exists and is tinted.
   *
   * @param owner Game entity owner group.
   */
  static refresh(owner: THREE.Object3D): void {
    const marker = EntityVisualPointBox.ensure(owner, {
      name: 'Game Entity Marker',
      iconName: GAME_ENTITY_ICON_NAME,
      colorHex: GameEntityVisualBuilder.colorOf(owner),
      opacity: 1,
      beforeRender: () => GameEntityVisualBuilder.tintIfStale(owner, marker),
    });
    GameEntityVisualBuilder.tintIfStale(owner, marker);
  }

  /**
   * Returns the marker color of an object's components.
   *
   * @param owner Object carrying game components.
   * @returns Color of the first attached class the editor knows, or grey.
   */
  static colorOf(owner: THREE.Object3D): number {
    const typePaths = Object.keys(GameEntityComponentStore.read(owner)).sort();
    for (const typePath of typePaths) {
      const gameClass = GameEntityClassRegistry.classFind(typePath);
      if (gameClass) {
        return GameEntityVisualBuilder.classColorOf(gameClass);
      }
    }
    return GAME_ENTITY_UNKNOWN_COLOR;
  }

  /**
   * Returns the marker color of a component class.
   *
   * @param gameClass Component class.
   * @returns Color as an sRGB hex number.
   */
  static classColorOf(gameClass: GameEntityClass): number {
    const [red, green, blue] = gameClass.marker_color;
    return new THREE.Color().setRGB(red, green, blue, THREE.SRGBColorSpace).getHex(THREE.SRGBColorSpace);
  }

  /**
   * Tints the marker again when the classes or the attached components changed
   * since the last tint.
   *
   * @param owner Game entity owner group.
   * @param marker Marker mesh.
   */
  private static tintIfStale(owner: THREE.Object3D, marker: THREE.Mesh): void {
    const typePaths = Object.keys(GameEntityComponentStore.read(owner)).join('|');
    const tintKey = `${GameEntityClassRegistry.generation()}:${typePaths}`;
    if (marker.userData[GAME_ENTITY_MARKER_TINT_KEY] === tintKey) {
      return;
    }
    marker.userData[GAME_ENTITY_MARKER_TINT_KEY] = tintKey;
    EntityVisualPointBox.tint(owner, GameEntityVisualBuilder.colorOf(owner), 1);
  }
}
