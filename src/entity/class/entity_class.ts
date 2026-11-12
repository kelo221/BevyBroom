import type * as THREE from 'three';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import { entityOwnerIs, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/**
 * What a class is placed as: a point entity of its own, or a brush that keeps
 * its geometry and carries the class.
 */
export type EntityClassPlacement = 'point' | 'brush';

/**
 * One class a scene object can be, as Hammer's Class dropdown lists them: a
 * light, a room, a game component class and so on. A class recognizes its
 * objects and describes how an object's class state changes when it becomes or
 * stops being of the class.
 */
export abstract class EntityClass {
  /** Stable id, shared with the Add menu entry of the same kind. */
  abstract readonly id: string;
  /** Visible class name. */
  abstract readonly label: string;
  /** Category the class is listed under. */
  abstract readonly category: string;
  /** Text the Object Properties help box shows for the class. */
  abstract readonly helpText: string;
  /** Whether the class is a point entity or a brush. */
  abstract readonly placement: EntityClassPlacement;

  /**
   * Returns whether an object is of this class.
   *
   * @param object Scene object.
   * @returns True when the object is of this class.
   */
  abstract matches(object: THREE.Object3D): boolean;

  /**
   * Returns whether an object may become of this class.
   *
   * @param object Scene object.
   * @returns True when the class fits the object.
   */
  abstract canApplyTo(object: THREE.Object3D): boolean;

  /**
   * Returns the class state of an object after it became of this class.
   *
   * @param state Class state without the previous class.
   * @returns Class state with this class.
   */
  abstract stateEnter(state: EntityClassObjectState): EntityClassObjectState;

  /**
   * Returns the icon menus and pickers show for the class.
   *
   * @returns Icon name.
   */
  abstract iconName(): IconName;

  /**
   * Returns the class state of an object after it stopped being of this class.
   * Classes that leave a mark on the state override it; the default keeps the
   * state.
   *
   * @param state Class state with this class.
   * @returns Class state without this class.
   */
  stateLeave(state: EntityClassObjectState): EntityClassObjectState {
    return state;
  }

  /**
   * Returns the color the class icon is drawn in. Classes with their own color
   * override it; the default is null for the plain text color.
   *
   * @returns Icon color as a hex number, or null.
   */
  iconColorHex(): number | null {
    return null;
  }
}

/** A class that is an entity owner of its own, placed at a point. */
export abstract class EntityClassPoint extends EntityClass {
  readonly placement: EntityClassPlacement = 'point';

  /**
   * Returns whether an object is an entity owner, which any point class fits.
   *
   * @param object Scene object.
   * @returns True for entity owners.
   */
  canApplyTo(object: THREE.Object3D): boolean {
    return entityOwnerIs(object);
  }

  /**
   * Returns whether the Entity tool offers the class for placing new entities.
   * Classes that only carry data override it; the default is true.
   *
   * @returns True when new entities may be placed as this class.
   */
  placeableIs(): boolean {
    return true;
  }

  /**
   * Creates a new owner of this class, named after it.
   *
   * @returns New entity owner group.
   */
  abstract ownerCreate(): THREE.Group;
}

/** A class that scene geometry such as a solid brush carries. */
export abstract class EntityClassBrush extends EntityClass {
  readonly placement: EntityClassPlacement = 'brush';

  /**
   * Returns whether an object is scene geometry other than an entity or a
   * modifier volume, which the brush classes never take.
   *
   * @param object Scene object.
   * @returns True for brush geometry.
   */
  canApplyTo(object: THREE.Object3D): boolean {
    return !entityOwnerIs(object) && !entityVisualPartIs(object) && !ModifierVolume.isVolume(object);
  }
}
