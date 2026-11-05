import type * as THREE from 'three';
import {
  ENTITY_KIND_USERDATA_KEY,
  ENTITY_SETTINGS_USERDATA_KEY,
  entityKindRead,
} from '@/entity/model/entity_owner_keys.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import {
  type GameEntityComponents,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';

/** Everything that decides the class of a scene object. */
export interface EntityClassObjectState {
  /** Entity kind of the object, or null for objects that are no entity owner. */
  readonly entityKind: string | null;
  /** Settings of the entity kind; undefined without a kind. */
  readonly entitySettings: unknown;
  /** Game component overrides. */
  readonly gameComponents: GameEntityComponents;
  /** Local scale, which some entity kinds keep at one. */
  readonly scale: readonly [number, number, number];
}

/**
 * Reads and writes the class state of scene objects. Writing a state of another
 * entity kind rebuilds the object's visuals for that kind on the same marker,
 * so the object keeps its identity, place in the scene and selection.
 */
export class EntityClassObjectStateStore {
  /**
   * Returns an independent copy of an object's class state.
   *
   * @param object Scene object.
   * @returns Class state.
   */
  static capture(object: THREE.Object3D): EntityClassObjectState {
    const entityKind = entityKindRead(object);
    const settings: unknown = object.userData[ENTITY_SETTINGS_USERDATA_KEY];
    return {
      entityKind,
      entitySettings: entityKind === null || settings === undefined ? undefined : structuredClone(settings),
      gameComponents: GameEntityComponentStore.read(object),
      scale: [object.scale.x, object.scale.y, object.scale.z],
    };
  }

  /**
   * Gives an object a class state.
   *
   * @param object Scene object.
   * @param state Class state to write.
   */
  static write(object: THREE.Object3D, state: EntityClassObjectState): void {
    if (entityKindRead(object) !== state.entityKind) {
      EntityVisualBuilder.visualsResetForKindChange(object);
    }
    EntityClassObjectStateStore.kindWrite(object, state.entityKind);
    GameEntityComponentStore.write(object, state.gameComponents);
    object.scale.set(...state.scale);
    EntityClassObjectStateStore.settingsWrite(object, state);
  }

  /**
   * Returns whether two states describe the same class state.
   *
   * @param first First state.
   * @param second Second state.
   * @returns True when every part matches.
   */
  static equals(first: EntityClassObjectState, second: EntityClassObjectState): boolean {
    return JSON.stringify(first) === JSON.stringify(second);
  }

  /**
   * Stores the entity kind flag, removing it and the settings without a kind.
   *
   * @param object Scene object.
   * @param entityKind Kind to store, or null.
   */
  private static kindWrite(object: THREE.Object3D, entityKind: string | null): void {
    if (entityKind === null) {
      delete object.userData[ENTITY_KIND_USERDATA_KEY];
      delete object.userData[ENTITY_SETTINGS_USERDATA_KEY];
      return;
    }
    object.userData[ENTITY_KIND_USERDATA_KEY] = entityKind;
  }

  /**
   * Stores valid settings of the state's kind and refreshes the visuals.
   *
   * @param object Scene object.
   * @param state Class state being written.
   */
  private static settingsWrite(object: THREE.Object3D, state: EntityClassObjectState): void {
    const entityOwner = state.entityKind === null ? null : EntityOwnerRegistry.findByKind(state.entityKind);
    if (!entityOwner) {
      return;
    }
    const definition = entityOwner.definition;
    entityOwner.settingsWrite(
      object,
      definition.settingsFromUnknown(state.entitySettings) ?? definition.settingsCreateDefault(),
    );
  }
}
