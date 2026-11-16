import { describe, expect, it } from 'vitest';
import { COMMAND_SEARCH_HISTORY_LIMIT, CommandSearchHistory } from '@/ui/command_search/command_search_history.js';
import { commandSearchTestItemCreate } from './command_search_test_support.js';

/**
 * Proves the command search history moves recently run commands to the front,
 * most recent first, without repeats, up to its limit, and skips commands the
 * menus no longer offer.
 */
describe('CommandSearchHistory', () => {
  it('moves recently run commands to the front, most recent first, without repeats', () => {
    const items = ['First', 'Second', 'Third'].map((label) => commandSearchTestItemCreate(label));
    const history = new CommandSearchHistory();
    const [first, , third] = items;
    if (!first || !third) {
      throw new Error('Missing test items');
    }
    history.record(first.key);
    history.record(third.key);
    history.record(first.key);
    expect(history.recentFirstOrder(items).map((item) => item.label)).toEqual(['First', 'Third', 'Second']);
  });

  it('keeps only the most recent commands up to its limit and skips unknown ones', () => {
    const items = Array.from({ length: COMMAND_SEARCH_HISTORY_LIMIT + 2 }, (_unused, index) =>
      commandSearchTestItemCreate(`Command ${index}`),
    );
    const history = new CommandSearchHistory();
    items.forEach((item) => history.record(item.key));
    history.record('Gone/Command');
    const ordered = history.recentFirstOrder(items).map((item) => item.label);
    const expectedRecent = items
      .slice(-(COMMAND_SEARCH_HISTORY_LIMIT - 1))
      .reverse()
      .map((item) => item.label);
    expect(ordered.slice(0, COMMAND_SEARCH_HISTORY_LIMIT - 1)).toEqual(expectedRecent);
    expect(ordered).toHaveLength(items.length);
  });
});
