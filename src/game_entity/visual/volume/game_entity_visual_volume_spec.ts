import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassVariantNames } from '@/game_entity/class/game_entity_class_variant_names.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentValueList } from '@/game_entity/component/game_entity_component_value_list.js';
import { GameEntityVisualVolumeRunColors } from '@/game_entity/visual/volume/game_entity_visual_volume_run_colors.js';

/** Text placed between the labels of a list value. */
export const GAME_ENTITY_VOLUME_LABEL_SEPARATOR = ' · ';

/** One run a volume marker draws as a floor band. */
export interface GameEntityVolumeRun {
  variantId: string;
  label: string;
  /** Band color as an sRGB hex number. */
  colorHex: number;
}

/** What a volume marker draws for one object. */
export interface GameEntityVolumeSpec {
  /** Floor label, or null when the class names no label field. */
  labelText: string | null;
  isHatched: boolean;
  runs: GameEntityVolumeRun[];
  /** Marker color of the class as an sRGB hex number. */
  markerColorHex: number;
}

/**
 * Works out the label, hatching and runs of an object's volume marker from the
 * first attached class that names `marker_label_field`,
 * `marker_hatched_when_true` or `marker_runs_field`.
 */
export class GameEntityVisualVolumeSpecResolver {
  /**
   * Returns the volume marker spec of an object.
   *
   * @param object Object carrying game components.
   * @returns Spec, or null when no attached known class asks for a volume
   *   marker.
   */
  static specOf(object: THREE.Object3D): GameEntityVolumeSpec | null {
    const components = GameEntityComponentStore.read(object);
    for (const typePath of Object.keys(components).sort()) {
      const gameClass = GameEntityClassRegistry.classFind(typePath);
      if (gameClass !== null && GameEntityVisualVolumeSpecResolver.classDrawsVolumeIs(gameClass)) {
        return GameEntityVisualVolumeSpecResolver.classSpecOf(gameClass, components);
      }
    }
    return null;
  }

  /**
   * Returns whether a class names any volume marker key.
   *
   * @param gameClass Component class.
   * @returns True when it names a label, hatching or runs field.
   */
  static classDrawsVolumeIs(gameClass: GameEntityClass): boolean {
    return (
      gameClass.marker_label_field !== undefined ||
      gameClass.marker_hatched_when_true !== undefined ||
      gameClass.marker_runs_field !== undefined
    );
  }

  /**
   * Returns the spec one class gives an object.
   *
   * @param gameClass Component class naming volume marker keys.
   * @param components Component overrides of the object.
   * @returns Spec.
   */
  static classSpecOf(gameClass: GameEntityClass, components: GameEntityComponents): GameEntityVolumeSpec {
    const markerColorHex = GameEntityVisualVolumeRunColors.srgbHexOf(gameClass.marker_color);
    return {
      labelText: GameEntityVisualVolumeSpecResolver.labelTextOf(gameClass, components),
      isHatched: GameEntityVisualVolumeSpecResolver.isHatchedOf(gameClass, components),
      runs: GameEntityVisualVolumeSpecResolver.runsOf(gameClass, components, markerColorHex),
      markerColorHex,
    };
  }

  /**
   * Returns the floor label text of the class's label field.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns Labels of a list value joined, the label of an enum value, other
   *   values as text, or null without a known label field.
   */
  private static labelTextOf(gameClass: GameEntityClass, components: GameEntityComponents): string | null {
    const field = GameEntityVisualVolumeSpecResolver.fieldOf(gameClass, gameClass.marker_label_field);
    if (field === null) {
      return null;
    }
    if (field.kind === 'enum_list') {
      const variants = GameEntityComponentValueList.variantsEffective(components, gameClass.type_path, field);
      const labels = variants.map((variant) => GameEntityClassVariantNames.labelOf(field, variant));
      return labels.join(GAME_ENTITY_VOLUME_LABEL_SEPARATOR);
    }
    const value = GameEntityComponentResolver.valueEffective(components, gameClass.type_path, field);
    return field.kind === 'enum' ? GameEntityClassVariantNames.labelOf(field, String(value)) : String(value);
  }

  /**
   * Returns whether the class's hatching bool field holds true.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns True when the named bool field is effectively true.
   */
  private static isHatchedOf(gameClass: GameEntityClass, components: GameEntityComponents): boolean {
    const field = GameEntityVisualVolumeSpecResolver.fieldOf(gameClass, gameClass.marker_hatched_when_true);
    return (
      field !== null &&
      field.kind === 'bool' &&
      GameEntityComponentResolver.valueEffective(components, gameClass.type_path, field) === true
    );
  }

  /**
   * Returns the runs of the class's runs field, in list order.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @param markerColorHex Class marker color the fallback band colors vary.
   * @returns One run per list entry; empty without a known runs field.
   */
  private static runsOf(
    gameClass: GameEntityClass,
    components: GameEntityComponents,
    markerColorHex: number,
  ): GameEntityVolumeRun[] {
    const field = GameEntityVisualVolumeSpecResolver.fieldOf(gameClass, gameClass.marker_runs_field);
    if (field === null) {
      return [];
    }
    const variants = GameEntityComponentValueList.variantsEffective(components, gameClass.type_path, field);
    return variants.map((variantId, index) => ({
      variantId,
      label: GameEntityClassVariantNames.labelOf(field, variantId),
      colorHex: GameEntityVisualVolumeRunColors.runColorOf(field, variantId, index, markerColorHex),
    }));
  }

  /**
   * Returns the value field a class key names.
   *
   * @param gameClass Component class.
   * @param fieldPath Field path the key holds, or undefined when unset.
   * @returns The field, or null when unset or unknown.
   */
  private static fieldOf(gameClass: GameEntityClass, fieldPath: string | undefined): GameEntityField | null {
    return fieldPath === undefined ? null : GameEntityComponentResolver.fieldFind(gameClass, fieldPath);
  }
}
