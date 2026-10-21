import * as THREE from 'three';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';

/** Marker color of game entities whose classes the editor does not know. */
export const GAME_ENTITY_UNKNOWN_COLOR = 0x808080;

/** Edge length of the clickable game entity marker in meters. */
const GAME_ENTITY_MARKER_SIZE = 0.3;

/** UserData key on the marker holding the state its tint was computed from. */
const GAME_ENTITY_MARKER_TINT_KEY = 'gameEntityTintKey';

/**
 * Shared marker geometry; never disposed because every game entity marker uses
 * it.
 */
const gameEntityMarkerGeometry = new THREE.BoxGeometry(
  GAME_ENTITY_MARKER_SIZE,
  GAME_ENTITY_MARKER_SIZE,
  GAME_ENTITY_MARKER_SIZE,
);

/**
 * Builds the editor-only marker of a game entity: a cube tinted with the marker
 * color of its first known component class. The tint follows class and
 * component changes when the marker is next drawn.
 */
export class GameEntityVisualBuilder {
  /**
   * Ensures the marker exists and is tinted.
   *
   * @param owner Game entity owner group.
   */
  static refresh(owner: THREE.Object3D): void {
    const marker = EntityVisualBuilder.markerEnsure(owner, gameEntityMarkerGeometry, 'Game Entity Marker');
    marker.onBeforeRender = () => GameEntityVisualBuilder.tintIfStale(owner, marker);
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
        const [red, green, blue] = gameClass.marker_color;
        return new THREE.Color().setRGB(red, green, blue, THREE.SRGBColorSpace).getHex(THREE.SRGBColorSpace);
      }
    }
    return GAME_ENTITY_UNKNOWN_COLOR;
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
    EntityVisualBuilder.markerTint(marker, GameEntityVisualBuilder.colorOf(owner), 1);
  }
}
