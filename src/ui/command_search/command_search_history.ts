import type { CommandSearchItem } from '@/ui/command_search/command_search_item.js';

/** Number of recently run commands the history keeps. */
export const COMMAND_SEARCH_HISTORY_LIMIT = 8;

/**
 * Remembers the commands run from the command search, most recent first, so an
 * empty search lists them at the top.
 */
export class CommandSearchHistory {
  private readonly recentKeys: string[] = [];

  /**
   * Records a run command as the most recent one.
   *
   * @param key Command key.
   */
  record(key: string): void {
    const existingIndex = this.recentKeys.indexOf(key);
    if (existingIndex >= 0) {
      this.recentKeys.splice(existingIndex, 1);
    }
    this.recentKeys.unshift(key);
    this.recentKeys.length = Math.min(this.recentKeys.length, COMMAND_SEARCH_HISTORY_LIMIT);
  }

  /**
   * Orders commands with the recently run ones first, most recent first, and
   * every other command after them in their given order.
   *
   * @param items Commands in menu order.
   * @returns Commands with the recent ones moved to the front.
   */
  recentFirstOrder(items: readonly CommandSearchItem[]): CommandSearchItem[] {
    const itemsByKey = new Map(items.map((item) => [item.key, item]));
    const recentItems = this.recentKeys
      .map((key) => itemsByKey.get(key))
      .filter((item): item is CommandSearchItem => item !== undefined);
    const recentKeySet = new Set(recentItems.map((item) => item.key));
    return [...recentItems, ...items.filter((item) => !recentKeySet.has(item.key))];
  }
}
