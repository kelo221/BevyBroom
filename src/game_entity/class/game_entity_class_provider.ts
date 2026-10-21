import { type GameEntityClassList, gameEntityClassListEmpty } from '@/game_entity/class/game_entity_class_schema.js';

/**
 * One source of game component classes, such as the connected game, the class
 * snapshot saved in the document or the classes the editor always knows.
 * Listeners hear about every new list.
 */
export class GameEntityClassProvider {
  readonly providerName: string;
  private list: GameEntityClassList;
  private readonly changeListeners = new Set<() => void>();

  /**
   * Creates an empty provider.
   *
   * @param providerName Unique name used in diagnostics.
   */
  constructor(providerName: string) {
    this.providerName = providerName;
    this.list = gameEntityClassListEmpty();
  }

  /**
   * Returns the provider's current classes and asset types.
   *
   * @returns Class list; callers must not modify it.
   */
  listRead(): GameEntityClassList {
    return this.list;
  }

  /**
   * Replaces the classes and asset types and tells every listener.
   *
   * @param list New class list.
   */
  listWrite(list: GameEntityClassList): void {
    this.list = list;
    this.changeListeners.forEach((listener) => listener());
  }

  /**
   * Registers a callback run after every new list.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
}
