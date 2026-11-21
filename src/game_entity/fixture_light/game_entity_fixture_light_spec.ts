import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityVariantLight } from '@/game_entity/class/game_entity_class_variant_light.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';

/** The light an entity's current variant asks for. */
export interface GameEntityFixtureLightSpec {
  /** Class, field and value the light comes from; changes with the variant. */
  readonly variantKey: string;
  /** Light the variant declares. */
  readonly light: GameEntityVariantLight;
}

/**
 * Finds the light an entity carries because one of its enum fields holds a
 * variant whose details declare a light.
 */
export class GameEntityFixtureLightSpecResolver {
  /**
   * Returns the light an entity's variants ask for.
   *
   * @param owner Entity owner carrying game components.
   * @returns The light of the first known class, in type path order, whose enum
   *   field holds a variant with a light, or null when none does.
   */
  static specOf(owner: THREE.Object3D): GameEntityFixtureLightSpec | null {
    const components = GameEntityComponentStore.read(owner);
    for (const typePath of Object.keys(components).sort()) {
      const gameClass = GameEntityClassRegistry.classFind(typePath);
      const spec = gameClass === null ? null : GameEntityFixtureLightSpecResolver.classSpecOf(gameClass, components);
      if (spec !== null) {
        return spec;
      }
    }
    return null;
  }

  /**
   * Returns the light one class gives an entity.
   *
   * @param gameClass Component class.
   * @param components Component overrides of the entity.
   * @returns The light of the first enum field whose value declares one, or
   *   null.
   */
  private static classSpecOf(
    gameClass: GameEntityClass,
    components: GameEntityComponents,
  ): GameEntityFixtureLightSpec | null {
    for (const field of GameEntityComponentResolver.fieldsLeaf(gameClass.fields)) {
      const spec = GameEntityFixtureLightSpecResolver.fieldSpecOf(gameClass, field, components);
      if (spec !== null) {
        return spec;
      }
    }
    return null;
  }

  /**
   * Returns the light the current value of one field declares.
   *
   * @param gameClass Component class.
   * @param field Field of the class.
   * @param components Component overrides of the entity.
   * @returns The light and its variant key, or null when the field is not an
   *   enum or its value declares no light.
   */
  private static fieldSpecOf(
    gameClass: GameEntityClass,
    field: GameEntityField,
    components: GameEntityComponents,
  ): GameEntityFixtureLightSpec | null {
    if (field.kind !== 'enum' || field.variant_details === undefined) {
      return null;
    }
    const value = GameEntityComponentResolver.valueEffective(components, gameClass.type_path, field);
    const light = typeof value === 'string' ? field.variant_details[value]?.light : undefined;
    if (light === undefined) {
      return null;
    }
    return { variantKey: `${gameClass.type_path}|${field.path}=${String(value)}`, light };
  }
}
