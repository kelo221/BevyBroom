import * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualMarkerModel } from '@/game_entity/visual/game_entity_visual_marker_model.js';

/** Share of its normal opacity a dimmed marker, icon and model keep. */
export const GAME_ENTITY_MARKER_DIMMED_OPACITY = 0.3;

/** Material userData key holding the opacity a model material had when loaded. */
const GAME_ENTITY_MARKER_DIM_BASE_OPACITY_KEY = 'gameEntityMarkerDimBaseOpacity';

/**
 * Material userData key holding whether a model material was transparent when
 * loaded.
 */
const GAME_ENTITY_MARKER_DIM_BASE_TRANSPARENT_KEY = 'gameEntityMarkerDimBaseTransparent';

/**
 * Decides whether a game entity's marker is drawn dimmed: when a bool field
 * that its class marks with `marker_dimmed_when_false` holds false.
 */
export class GameEntityVisualMarkerDim {
  /**
   * Returns whether an object's marker is dimmed.
   *
   * @param owner Object carrying game components.
   * @returns True when any attached known class has a dimming bool field whose
   *   effective value is false.
   */
  static isDimmed(owner: THREE.Object3D): boolean {
    const components = GameEntityComponentStore.read(owner);
    return Object.keys(components).some((typePath) => {
      const gameClass = GameEntityClassRegistry.classFind(typePath);
      return gameClass !== null && GameEntityVisualMarkerDim.classDimsIs(gameClass, components);
    });
  }

  /**
   * Returns the opacity share an object's marker is drawn with.
   *
   * @param owner Object carrying game components.
   * @returns {@link GAME_ENTITY_MARKER_DIMMED_OPACITY} When dimmed, else one.
   */
  static opacityOf(owner: THREE.Object3D): number {
    return GameEntityVisualMarkerDim.isDimmed(owner) ? GAME_ENTITY_MARKER_DIMMED_OPACITY : 1;
  }

  /**
   * Returns whether one class dims the marker for the given overrides.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns True when a dimming bool field of the class is effectively false.
   */
  static classDimsIs(gameClass: GameEntityClass, components: GameEntityComponents): boolean {
    return GameEntityComponentResolver.fieldsLeaf(gameClass.fields).some(
      (field) =>
        field.kind === 'bool' &&
        field.marker_dimmed_when_false === true &&
        GameEntityComponentResolver.valueEffective(components, gameClass.type_path, field) === false,
    );
  }

  /**
   * Draws the owner's marker model with an opacity share of the opacity its
   * materials were loaded with.
   *
   * @param owner Game entity owner group.
   * @param opacity Share of the loaded opacity, one for the normal look.
   */
  static modelOpacityApply(owner: THREE.Object3D, opacity: number): void {
    GameEntityVisualMarkerModel.find(owner)?.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        const materials: THREE.Material[] = Array.isArray(part.material) ? part.material : [part.material];
        materials.forEach((material) => GameEntityVisualMarkerDim.materialOpacityApply(material, opacity));
      }
    });
  }

  /**
   * Sets one model material to a share of its loaded opacity, remembering the
   * loaded opacity and transparency the first time.
   *
   * @param material Material of the marker model copy.
   * @param opacity Share of the loaded opacity.
   */
  private static materialOpacityApply(material: THREE.Material, opacity: number): void {
    if (material.userData[GAME_ENTITY_MARKER_DIM_BASE_OPACITY_KEY] === undefined) {
      material.userData[GAME_ENTITY_MARKER_DIM_BASE_OPACITY_KEY] = material.opacity;
      material.userData[GAME_ENTITY_MARKER_DIM_BASE_TRANSPARENT_KEY] = material.transparent;
    }
    const baseOpacity = material.userData[GAME_ENTITY_MARKER_DIM_BASE_OPACITY_KEY] as number;
    const baseTransparent = material.userData[GAME_ENTITY_MARKER_DIM_BASE_TRANSPARENT_KEY] as boolean;
    const transparent = baseTransparent || opacity < 1;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = baseOpacity * opacity;
  }
}
