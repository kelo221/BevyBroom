import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityIoPin } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { LOGIC_UNIVERSAL_INPUT_NAMES } from './game_entity_logic_types.js';

/** Descriptions of the inputs every named object accepts in the game. */
const GAME_ENTITY_LOGIC_UNIVERSAL_INPUT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  Enable: 'Lets the object fire its outputs and receive inputs again',
  Disable: 'Stops the object from firing outputs and receiving inputs',
  Cancel: 'Cancels the delayed outputs this object fired that have not arrived yet',
};

/**
 * Lists the entity I/O outputs and inputs objects offer, read from the game
 * component classes they carry.
 */
export class GameEntityLogicPins {
  /**
   * Returns every output the classes of an object declare, each name once.
   *
   * @param object Scene object.
   * @returns Output pins in class order.
   */
  static outputsOfObject(object: THREE.Object3D): GameEntityIoPin[] {
    return GameEntityLogicPins.pinsUnique(
      GameEntityLogicPins.classesOfObject(object).flatMap((gameClass) => gameClass.outputs ?? []),
    );
  }

  /**
   * Returns every input the classes of some objects declare followed by the
   * universal inputs, each name once.
   *
   * @param objects Scene objects, usually the targets of one connection.
   * @returns Input pins.
   */
  static inputsOfObjects(objects: readonly THREE.Object3D[]): GameEntityIoPin[] {
    const declared = objects.flatMap((object) =>
      GameEntityLogicPins.classesOfObject(object).flatMap((gameClass) => gameClass.inputs ?? []),
    );
    return GameEntityLogicPins.pinsUnique([...declared, ...GameEntityLogicPins.universalInputsList()]);
  }

  /**
   * Returns the inputs every named object accepts.
   *
   * @returns Universal input pins.
   */
  static universalInputsList(): GameEntityIoPin[] {
    return LOGIC_UNIVERSAL_INPUT_NAMES.map((name) => ({
      name,
      description: GAME_ENTITY_LOGIC_UNIVERSAL_INPUT_DESCRIPTIONS[name] ?? '',
    }));
  }

  /**
   * Returns the known classes of the game components an object carries.
   *
   * @param object Scene object.
   * @returns Classes the editor knows.
   */
  private static classesOfObject(object: THREE.Object3D): GameEntityClass[] {
    return Object.keys(GameEntityComponentStore.read(object))
      .map((typePath) => GameEntityClassRegistry.classFind(typePath))
      .filter((gameClass): gameClass is GameEntityClass => gameClass !== null);
  }

  /**
   * Keeps the first pin of every name.
   *
   * @param pins Pins in priority order.
   * @returns Pins with unique names.
   */
  private static pinsUnique(pins: readonly GameEntityIoPin[]): GameEntityIoPin[] {
    const byName = new Map<string, GameEntityIoPin>();
    pins.forEach((pin) => {
      if (!byName.has(pin.name)) {
        byName.set(pin.name, pin);
      }
    });
    return [...byName.values()];
  }
}
