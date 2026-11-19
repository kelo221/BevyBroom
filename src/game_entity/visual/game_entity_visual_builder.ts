import * as THREE from 'three';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import {
  ENTITY_POINT_BOX_SHAPE_DEFAULT,
  EntityVisualPointBoxGeometry,
} from '@/entity/visual/entity_visual_point_box_geometry.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';
import { GameEntityVisualMarkerModel } from '@/game_entity/visual/game_entity_visual_marker_model.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { Theme } from '@/theme.js';

/** Marker color of game entities whose classes the editor does not know. */
export const GAME_ENTITY_UNKNOWN_COLOR = Theme.gameEntityUnknownColor;

/** Icon every game entity shows. */
export const GAME_ENTITY_ICON_NAME: IconName = 'puzzle';

/** UserData key on the marker holding the state its look was computed from. */
const GAME_ENTITY_MARKER_LOOK_KEY = 'gameEntityLookKey';

/** Name of the marker mesh of game entities. */
const GAME_ENTITY_MARKER_NAME = 'Game Entity Marker';

/**
 * Builds the editor-only marker of a game entity: a box with a camera-facing
 * icon, tinted with the marker color of its first known component class and
 * sized by the marker box its classes declare, with the model that box names
 * drawn at the entity's origin once it is loaded. Tint, box and model follow
 * class, component and model changes when the marker is next drawn.
 */
export class GameEntityVisualBuilder {
  /**
   * Ensures the marker exists and is tinted.
   *
   * @param owner Game entity owner group.
   */
  static refresh(owner: THREE.Object3D): void {
    const marker = EntityVisualPointBox.ensure(owner, {
      name: GAME_ENTITY_MARKER_NAME,
      iconName: GAME_ENTITY_ICON_NAME,
      colorHex: GameEntityVisualBuilder.colorOf(owner),
      opacity: 1,
      beforeRender: () => GameEntityVisualBuilder.lookIfStale(owner, marker),
    });
    GameEntityVisualBuilder.lookIfStale(owner, marker);
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
   * Sizes, tints and fills the marker again when the classes, the attached
   * components or the loaded models changed since the last time.
   *
   * @param owner Game entity owner group.
   * @param marker Marker mesh.
   */
  private static lookIfStale(owner: THREE.Object3D, marker: THREE.Mesh): void {
    const markerBox = GameEntityVisualMarkerBox.boxOf(owner);
    const lookKey = GameEntityVisualBuilder.lookKeyOf(owner, markerBox);
    if (marker.userData[GAME_ENTITY_MARKER_LOOK_KEY] === lookKey) {
      return;
    }
    marker.userData[GAME_ENTITY_MARKER_LOOK_KEY] = lookKey;
    EntityVisualPointBox.shapeApply(owner, markerBox ?? ENTITY_POINT_BOX_SHAPE_DEFAULT, GAME_ENTITY_MARKER_NAME);
    EntityVisualPointBox.tint(owner, GameEntityVisualBuilder.colorOf(owner), 1);
    GameEntityVisualMarkerModel.apply(owner, markerBox?.model ?? null);
  }

  /**
   * Returns a text key that changes whenever the classes, the attached
   * components, the chosen marker box or the loaded models change.
   *
   * @param owner Game entity owner group.
   * @param markerBox Chosen marker box, or null for the plain point marker.
   * @returns Key text.
   */
  private static lookKeyOf(owner: THREE.Object3D, markerBox: GameEntityMarkerBox | null): string {
    const typePaths = Object.keys(GameEntityComponentStore.read(owner)).join('|');
    const shapeKey = EntityVisualPointBoxGeometry.shapeKeyOf(markerBox ?? ENTITY_POINT_BOX_SHAPE_DEFAULT);
    const modelKey = `${GameEntityModelLibrary.shared.generation()}:${markerBox?.model ?? ''}`;
    return `${GameEntityClassRegistry.generation()}:${typePaths}:${shapeKey}:${modelKey}`;
  }
}
