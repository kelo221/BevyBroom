import { GameEntityClassCache } from '@/game_entity/class/game_entity_class_cache.js';
import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import type { GameEntityClassList } from '@/game_entity/class/game_entity_class_schema.js';

/**
 * Classes reported by the connected game. Every list is cached per project and
 * the cached list stands in until a newly connected game answers.
 */
export class GameEntityClassProviderPreview extends GameEntityClassProvider {
  /** The provider fed by the game preview link. */
  static readonly shared = new GameEntityClassProviderPreview();
  private projectIdentifier = '';

  /** Creates the provider. */
  constructor() {
    super('preview');
  }

  /**
   * Switches to a game project and shows its cached classes until the game
   * reports its own.
   *
   * @param projectIdentifier Game project id.
   */
  projectAdopt(projectIdentifier: string): void {
    this.projectIdentifier = projectIdentifier;
    const cached = GameEntityClassCache.read(projectIdentifier);
    if (cached) {
      super.listWrite(cached);
    }
  }

  /**
   * Shows the game's classes and caches them for the current project.
   *
   * @param list Class list reported by the game.
   */
  override listWrite(list: GameEntityClassList): void {
    GameEntityClassCache.write(this.projectIdentifier, list);
    super.listWrite(list);
  }
}
