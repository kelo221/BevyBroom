import type * as THREE from 'three';
import { EntityClassBrush } from '@/entity/class/entity_class.js';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { EntityClassGameClassParts } from './entity_class_game_class_parts.js';

/** Icon of brush entity classes. */
const ENTITY_CLASS_BRUSH_GAME_ICON: IconName = 'shape-outline';

/**
 * Prefix that keeps brush class ids apart from the point classes of the same
 * game class.
 */
export const ENTITY_CLASS_BRUSH_GAME_ID_PREFIX = 'brushes.';

/**
 * A game component class carried by a brush, like Hammer's brush entities: the
 * brush keeps its geometry and gains the class's component.
 */
export class EntityClassBrushGame extends EntityClassBrush {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly helpText: string;
  private readonly parts: EntityClassGameClassParts;

  /**
   * Creates the brush class of a game class.
   *
   * @param gameClass Game component class that may be placed on any object.
   */
  constructor(gameClass: GameEntityClass) {
    super();
    this.parts = new EntityClassGameClassParts(gameClass);
    this.id = `${ENTITY_CLASS_BRUSH_GAME_ID_PREFIX}${this.parts.idRead()}`;
    this.label = gameClass.label;
    this.category = gameClass.category;
    this.helpText = this.parts.helpTextRead();
  }

  /**
   * Returns whether an object is a brush carrying the class.
   *
   * @param object Scene object.
   * @returns True for brushes of the class.
   */
  matches(object: THREE.Object3D): boolean {
    return this.canApplyTo(object) && this.parts.isCarriedBy(object);
  }

  /**
   * Attaches the class's component.
   *
   * @param state Class state without the previous class.
   * @returns State with the component.
   */
  stateEnter(state: EntityClassObjectState): EntityClassObjectState {
    return this.parts.componentAttach(state);
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
   * Returns the brush icon.
   *
   * @returns Icon name.
   */
  iconName(): IconName {
    return ENTITY_CLASS_BRUSH_GAME_ICON;
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
