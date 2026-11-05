import type * as THREE from 'three';
import { EntityClassBrush } from '@/entity/class/entity_class.js';
import type { EntityClassObjectState } from '@/entity/class/entity_class_object_state.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Id of the plain world brush class. */
export const ENTITY_CLASS_SOLID_WORLD_ID = 'brushes.solid_world';

/**
 * Plain world geometry, Hammer's worldspawn brushes: a brush that carries no
 * game class that may be placed on brushes.
 */
export class EntityClassBrushSolidWorld extends EntityClassBrush {
  readonly id = ENTITY_CLASS_SOLID_WORLD_ID;
  readonly label = 'Solid (world)';
  readonly category = 'Brushes';
  readonly helpText = 'Static world geometry without a game class. The game loads it as part of the level.';

  /**
   * Returns whether an object is a brush without any brush entity class.
   *
   * @param object Scene object.
   * @returns True for plain world brushes.
   */
  matches(object: THREE.Object3D): boolean {
    if (!this.canApplyTo(object)) {
      return false;
    }
    const components = GameEntityComponentStore.read(object);
    return !GameEntityClassRegistry.classesList().some(
      (gameClass) => gameClass.placement === 'any' && Object.hasOwn(components, gameClass.type_path),
    );
  }

  /**
   * Keeps the state, which lost its brush entity class when it left it.
   *
   * @param state Class state without the previous class.
   * @returns The same state.
   */
  stateEnter(state: EntityClassObjectState): EntityClassObjectState {
    return state;
  }

  /**
   * Returns the brush icon.
   *
   * @returns Icon name.
   */
  iconName(): IconName {
    return 'cube-outline';
  }
}
