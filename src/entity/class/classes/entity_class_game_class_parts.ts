import type * as THREE from 'three';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';

/**
 * The parts every class made from a game component class shares, whether it is
 * placed as a point or carried by a brush: names, help text, icon color and the
 * component the class stands for.
 */
export class EntityClassGameClassParts {
  readonly gameClass: GameEntityClass;

  /**
   * Creates the parts of one game class.
   *
   * @param gameClass Game component class.
   */
  constructor(gameClass: GameEntityClass) {
    this.gameClass = gameClass;
  }

  /**
   * Returns the class id.
   *
   * @returns Id shared with the Add menu entry of the class.
   */
  idRead(): string {
    return gameEntityClassIdOf(this.gameClass.type_path);
  }

  /**
   * Returns the help box text: the category and the type path the game reads.
   *
   * @returns Help text.
   */
  helpTextRead(): string {
    return `Game class from the ${this.gameClass.category} category, read by the game as ${this.gameClass.type_path}.`;
  }

  /**
   * Returns the marker color of the class.
   *
   * @returns Color as a hex number.
   */
  iconColorHexRead(): number {
    return GameEntityVisualBuilder.classColorOf(this.gameClass);
  }

  /**
   * Returns whether an object carries the component of the class.
   *
   * @param object Scene object.
   * @returns True when the component is attached.
   */
  isCarriedBy(object: THREE.Object3D): boolean {
    return Object.hasOwn(GameEntityComponentStore.read(object), this.gameClass.type_path);
  }

  /**
   * Returns a class state with the component of the class attached.
   *
   * @param state Class state.
   * @returns State whose components include the class.
   */
  componentAttach(state: EntityClassObjectState): EntityClassObjectState {
    const gameComponents = GameEntityComponentsEdit.componentAdd(state.gameComponents, this.gameClass.type_path);
    return { ...state, gameComponents };
  }

  /**
   * Returns a class state without the component of the class.
   *
   * @param state Class state.
   * @returns State whose components lack the class.
   */
  componentDetach(state: EntityClassObjectState): EntityClassObjectState {
    const gameComponents = GameEntityComponentsEdit.componentRemove(state.gameComponents, this.gameClass.type_path);
    return { ...state, gameComponents };
  }
}
