import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { ICON_NAMES, type IconName } from '@/ui/icons/icon_name.js';

/** Icon of game entities whose classes name no known icon. */
export const GAME_ENTITY_ICON_NAME: IconName = 'puzzle';

/**
 * Picks the icon a game entity and a game class are shown with: the icon the
 * class file names when the editor has it, otherwise the default game entity
 * icon.
 */
export class GameEntityVisualIcon {
  /**
   * Returns the icon of one class.
   *
   * @param gameClass Component class.
   * @returns The icon the class names, or the default icon when it names none
   *   or one the editor does not have.
   */
  static classIconOf(gameClass: GameEntityClass): IconName {
    return GameEntityVisualIcon.iconNameRead(gameClass.icon) ?? GAME_ENTITY_ICON_NAME;
  }

  /**
   * Returns the icon of an object carrying game components.
   *
   * @param owner Object carrying game components.
   * @returns Icon of the first attached known class, in type path order, that
   *   names a known icon, or the default icon.
   */
  static ownerIconOf(owner: THREE.Object3D): IconName {
    const typePaths = Object.keys(GameEntityComponentStore.read(owner)).sort();
    for (const typePath of typePaths) {
      const iconName = GameEntityVisualIcon.iconNameRead(GameEntityClassRegistry.classFind(typePath)?.icon);
      if (iconName !== null) {
        return iconName;
      }
    }
    return GAME_ENTITY_ICON_NAME;
  }

  /**
   * Returns an icon name the editor has.
   *
   * @param candidate Icon name a class file gives, or undefined.
   * @returns The matching icon name, or null when the editor has no such icon.
   */
  private static iconNameRead(candidate: string | undefined): IconName | null {
    return ICON_NAMES.find((iconName) => iconName === candidate) ?? null;
  }
}
