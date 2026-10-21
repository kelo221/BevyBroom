import {
  type GameEntityClassList,
  gameEntityClassListFromUnknown,
} from '@/game_entity/class/game_entity_class_schema.js';
import { areEditorStorageWritesSuppressed } from '@/settings/storage/clear_editor_storage.js';

/** Storage key prefix of cached class lists; the project id follows. */
export const GAME_ENTITY_CLASS_CACHE_KEY_PREFIX = 'bevybroom.game_classes.';

/**
 * Remembers the last class list of each game project, so placed components keep
 * their fields and defaults while the game is not running.
 */
export class GameEntityClassCache {
  /**
   * Returns the cached class list of a project.
   *
   * @param projectIdentifier Game project id.
   * @returns Cached list, or null when none is stored or it is unreadable.
   */
  static read(projectIdentifier: string): GameEntityClassList | null {
    const stored = globalThis.localStorage?.getItem(GameEntityClassCache.keyOf(projectIdentifier));
    if (!stored) {
      return null;
    }
    try {
      return gameEntityClassListFromUnknown(JSON.parse(stored));
    } catch {
      return null;
    }
  }

  /**
   * Stores the class list of a project unless storage writes are suppressed.
   *
   * @param projectIdentifier Game project id.
   * @param list Class list to remember.
   */
  static write(projectIdentifier: string, list: GameEntityClassList): void {
    if (areEditorStorageWritesSuppressed() || projectIdentifier === '') {
      return;
    }
    globalThis.localStorage?.setItem(GameEntityClassCache.keyOf(projectIdentifier), JSON.stringify(list));
  }

  /**
   * Returns the storage key of a project.
   *
   * @param projectIdentifier Game project id.
   * @returns Storage key.
   */
  private static keyOf(projectIdentifier: string): string {
    return `${GAME_ENTITY_CLASS_CACHE_KEY_PREFIX}${projectIdentifier}`;
  }
}
