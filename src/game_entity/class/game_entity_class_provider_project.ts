import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';

/**
 * Classes declared in the open project's class file, shared by every level of
 * the project without the game running.
 */
export class GameEntityClassProviderProject extends GameEntityClassProvider {
  /** The provider holding the open project's declared classes. */
  static readonly shared = new GameEntityClassProviderProject();

  /** Creates the provider. */
  constructor() {
    super('project');
  }
}
