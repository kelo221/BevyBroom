import * as THREE from 'three';
import { ENTITY_MARKER_SOLID_USERDATA_KEY } from '@/entity/model/entity_owner_keys.js';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import {
  ENTITY_POINT_BOX_SHAPE_DEFAULT,
  EntityVisualPointBoxGeometry,
} from '@/entity/visual/entity_visual_point_box_geometry.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualIcon } from '@/game_entity/visual/game_entity_visual_icon.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import { GameEntityVisualMarkerModel } from '@/game_entity/visual/game_entity_visual_marker_model.js';
import { GameEntityVisualMarkerDim } from '@/game_entity/visual/game_entity_visual_marker_dim.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { Theme } from '@/theme.js';

/** Marker color of game entities whose classes the editor does not know. */
export const GAME_ENTITY_UNKNOWN_COLOR = Theme.gameEntityUnknownColor;

/** UserData key on the marker holding the state its look was computed from. */
const GAME_ENTITY_MARKER_LOOK_KEY = 'gameEntityLookKey';

/** Name of the marker mesh of game entities. */
const GAME_ENTITY_MARKER_NAME = 'Game Entity Marker';

/**
 * Builds the editor-only marker of a game entity: a box with a camera-facing
 * icon its classes name, tinted with the marker color of its first known
 * component class and sized by the marker box its classes declare, with the
 * model that box names stretched to fill the box once it is loaded. Marker,
 * icon and model are dimmed while a dimming bool field of a class is false.
 * Tint, box, dimming and model follow class, component and model changes when
 * the marker is next drawn; so does the icon.
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
      iconName: GameEntityVisualIcon.ownerIconOf(owner),
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
   * Sizes, tints, fills and gives the marker its icon again when the classes,
   * the attached components or the loaded models changed since the last time.
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
    marker.userData[ENTITY_MARKER_SOLID_USERDATA_KEY] = markerBox !== null;
    GameEntityVisualBuilder.lookTintAndModelApply(owner, markerBox);
  }

  /**
   * Tints the marker and icon, gives the owner the model its box names and fits
   * it, all at the dimmed or normal opacity.
   *
   * @param owner Game entity owner group.
   * @param markerBox Chosen marker box, or null for the plain point marker.
   */
  private static lookTintAndModelApply(owner: THREE.Object3D, markerBox: GameEntityMarkerBox | null): void {
    const opacity = GameEntityVisualMarkerDim.opacityOf(owner);
    EntityVisualPointBox.tint(owner, GameEntityVisualBuilder.colorOf(owner), opacity);
    EntityVisualBillboard.iconNameApply(owner, GameEntityVisualIcon.ownerIconOf(owner));
    GameEntityVisualMarkerModel.apply(owner, markerBox?.model ?? null);
    GameEntityVisualMarkerModel.fit(owner, markerBox);
    GameEntityVisualMarkerDim.modelOpacityApply(owner, opacity);
  }

  /**
   * Returns a text key that changes whenever the classes, the attached
   * components, the chosen marker box, the dimming or the loaded models
   * change.
   *
   * @param owner Game entity owner group.
   * @param markerBox Chosen marker box, or null for the plain point marker.
   * @returns Key text.
   */
  private static lookKeyOf(owner: THREE.Object3D, markerBox: GameEntityMarkerBox | null): string {
    const typePaths = Object.keys(GameEntityComponentStore.read(owner)).join('|');
    const shapeKey = EntityVisualPointBoxGeometry.shapeKeyOf(markerBox ?? ENTITY_POINT_BOX_SHAPE_DEFAULT);
    const modelKey = `${GameEntityModelLibrary.shared.generation()}:${markerBox?.model ?? ''}`;
    const dimKey = GameEntityVisualMarkerDim.isDimmed(owner) ? 'dim' : 'lit';
    return `${GameEntityClassRegistry.generation()}:${typePaths}:${shapeKey}:${modelKey}:${dimKey}`;
  }
}
