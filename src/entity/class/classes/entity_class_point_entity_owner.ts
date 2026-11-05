import type * as THREE from 'three';
import { EntityClassPoint } from '@/entity/class/entity_class.js';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import type { EntityClassPointVariant } from '@/entity/class/entity_class_point_variant.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { entityScaleKeptFor } from '@/entity/scale/entity_scale_allowed.js';

/**
 * A point class of an entity kind the editor authors itself, such as a point
 * light, a room or a portal: one variant of the kind's definition.
 */
export class EntityClassPointEntityOwner<TSettings extends object> extends EntityClassPoint {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly helpText: string;
  private readonly entityOwner: EntityOwner<TSettings>;
  private readonly variant: EntityClassPointVariant<TSettings>;

  /**
   * Creates the class of one variant.
   *
   * @param entityOwner Owner helper of the kind.
   * @param variant Variant of the kind's definition.
   */
  constructor(entityOwner: EntityOwner<TSettings>, variant: EntityClassPointVariant<TSettings>) {
    super();
    this.entityOwner = entityOwner;
    this.variant = variant;
    this.id = variant.id;
    this.label = variant.label;
    this.category = variant.category;
    this.helpText = variant.helpText;
  }

  /**
   * Returns whether an object is an owner of the kind with settings of the
   * variant.
   *
   * @param object Scene object.
   * @returns True for owners of this class.
   */
  matches(object: THREE.Object3D): boolean {
    const settings = this.entityOwner.settingsRead(object);
    return settings !== null && this.variant.settingsMatch(settings);
  }

  /**
   * Turns the state into an owner of the kind with the variant's settings. An
   * owner that already is of the kind keeps its other settings; kinds that
   * absorb scale or may not be scaled get a unit scale.
   *
   * @param state Class state without the previous class.
   * @returns Owner state of this class.
   */
  stateEnter(state: EntityClassObjectState): EntityClassObjectState {
    const definition = this.entityOwner.definition;
    const previous = state.entityKind === definition.kind ? definition.settingsFromUnknown(state.entitySettings) : null;
    const settings = definition.settingsSanitize(this.variant.settingsCreate(previous));
    return {
      ...state,
      entityKind: definition.kind,
      entitySettings: definition.settingsClone(settings),
      scale: entityScaleKeptFor(definition, state.scale),
    };
  }

  /**
   * Creates an owner of the class named after it.
   *
   * @returns New entity owner group.
   */
  ownerCreate(): THREE.Group {
    return this.entityOwner.create(this.label, this.variant.settingsCreate(null));
  }

  /**
   * Returns the icon of a new owner of the class.
   *
   * @returns Icon name.
   */
  iconName(): IconName {
    const definition = this.entityOwner.definition;
    return definition.iconName(definition.settingsSanitize(this.variant.settingsCreate(null)));
  }
}
