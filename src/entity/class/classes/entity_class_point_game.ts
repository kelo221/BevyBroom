import type * as THREE from 'three';
import { EntityClassPoint } from '@/entity/class/entity_class.js';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { gameEntityClassIsDataOnly } from '@/game_entity/class/game_entity_class_category_data.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { EntityClassGameClassParts } from './entity_class_game_class_parts.js';
import { entityScaleKeptFor } from '@/entity/scale/entity_scale_allowed.js';

/**
 * A game component class placed as a point: a game entity carrying the class's
 * component.
 */
export class EntityClassPointGame extends EntityClassPoint {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly helpText: string;
  private readonly parts: EntityClassGameClassParts;

  /**
   * Creates the point class of a game class.
   *
   * @param gameClass Game component class.
   */
  constructor(gameClass: GameEntityClass) {
    super();
    this.parts = new EntityClassGameClassParts(gameClass);
    this.id = this.parts.idRead();
    this.label = gameClass.label;
    this.category = gameClass.category;
    this.helpText = this.parts.helpTextRead();
  }

  /**
   * Returns whether an object is a game entity carrying the class.
   *
   * @param object Scene object.
   * @returns True for game entities of the class.
   */
  matches(object: THREE.Object3D): boolean {
    return GameEntityOwner.isOwner(object) && this.parts.isCarriedBy(object);
  }

  /**
   * Returns whether new entities may be placed as the class: not for classes
   * that only carry data, such as the Properties component.
   *
   * @returns False for data-only game classes.
   */
  override placeableIs(): boolean {
    return !gameEntityClassIsDataOnly(this.parts.gameClass);
  }

  /**
   * Turns the state into a game entity carrying the class, keeping the other
   * components; the scale becomes one because game entities may not be scaled.
   *
   * @param state Class state without the previous class.
   * @returns Game entity state.
   */
  stateEnter(state: EntityClassObjectState): EntityClassObjectState {
    const scale = entityScaleKeptFor(GameEntityOwner.definition, state.scale);
    const gameEntityState = { ...state, entityKind: GameEntityOwner.kind, entitySettings: {}, scale };
    return this.parts.componentAttach(gameEntityState);
  }

  /**
   * Removes the class's component.
   *
   * @param state Class state with this class.
   * @returns State without the component.
   */
  override stateLeave(state: EntityClassObjectState): EntityClassObjectState {
    return this.parts.componentDetach(state);
  }

  /**
   * Creates a game entity named after the class and carrying it.
   *
   * @returns New game entity owner.
   */
  ownerCreate(): THREE.Group {
    return gameEntityCreateForClass(this.parts.gameClass);
  }

  /**
   * Returns the game entity icon.
   *
   * @returns Icon name.
   */
  iconName(): IconName {
    return GameEntityOwner.definition.iconName({});
  }

  /**
   * Returns the marker color of the class.
   *
   * @returns Color as a hex number.
   */
  override iconColorHex(): number {
    return this.parts.iconColorHexRead();
  }
}
