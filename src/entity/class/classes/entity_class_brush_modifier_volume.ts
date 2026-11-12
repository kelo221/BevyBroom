import type * as THREE from 'three';
import { EntityClassBrush } from '@/entity/class/entity_class.js';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Id of the modifier volume class. */
export const ENTITY_CLASS_MODIFIER_VOLUME_ID = 'brushes.modifier_volume';

/** Icon of modifier volumes. */
const ENTITY_CLASS_MODIFIER_VOLUME_ICON: IconName = 'cube-outline';

/**
 * A modifier volume, Hammer's trigger-like editor volume: its box selects the
 * brushes its modifier stack turns. The class exists for the editor only, so
 * the game never receives it.
 */
export class EntityClassBrushModifierVolume extends EntityClassBrush {
  readonly id = ENTITY_CLASS_MODIFIER_VOLUME_ID;
  readonly label = 'Modifier Volume (editor only)';
  readonly category = 'Brushes';
  readonly helpText =
    'Editor-only volume. Its box selects the brushes its modifier stack turns. It is never exported to the game.';

  /**
   * Returns whether an object is a modifier volume.
   *
   * @param object Scene object.
   * @returns True for modifier volumes.
   */
  matches(object: THREE.Object3D): boolean {
    return this.canApplyTo(object);
  }

  /**
   * Returns whether an object may be a modifier volume, which only volumes are.
   *
   * @param object Scene object.
   * @returns True for modifier volumes.
   */
  override canApplyTo(object: THREE.Object3D): boolean {
    return ModifierVolume.isVolume(object);
  }

  /**
   * Keeps the state; a volume carries no game class state.
   *
   * @param state Class state without the previous class.
   * @returns The same state.
   */
  stateEnter(state: EntityClassObjectState): EntityClassObjectState {
    return state;
  }

  /**
   * Returns the volume icon.
   *
   * @returns Icon name.
   */
  iconName(): IconName {
    return ENTITY_CLASS_MODIFIER_VOLUME_ICON;
  }
}
