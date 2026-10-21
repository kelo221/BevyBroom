import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';

/**
 * Classes saved with the open document: a snapshot of every class its objects
 * use, so the document shows fields and defaults without the game.
 */
export class GameEntityClassProviderScene extends GameEntityClassProvider {
  /** The provider holding the open document's class snapshot. */
  static readonly shared = new GameEntityClassProviderScene();

  /** Creates the provider. */
  constructor() {
    super('scene');
  }
}
