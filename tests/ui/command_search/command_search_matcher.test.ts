import { describe, expect, it } from 'vitest';
import { CommandSearchMatcher } from '@/ui/command_search/command_search_matcher.js';
import { commandSearchTestItemCreate } from './command_search_test_support.js';

/**
 * Proves the command search ranking: every typed word must match, label
 * prefixes beat word prefixes, inner matches, menu titles and letters in order,
 * ties keep the shorter label and then menu order, and a blank query keeps the
 * given order.
 */
describe('CommandSearchMatcher', () => {
  const items = [
    commandSearchTestItemCreate('Save As\u2026', ['File']),
    commandSearchTestItemCreate('Subtract', ['Edit', 'CSG']),
    commandSearchTestItemCreate('Union', ['Edit', 'CSG']),
    commandSearchTestItemCreate('Hide Selected', ['View']),
    commandSearchTestItemCreate('Select All', ['Edit']),
    commandSearchTestItemCreate('Save', ['File']),
  ];

  /**
   * Ranks the shared commands and returns their labels.
   *
   * @param query Typed query.
   * @returns Ranked labels.
   */
  function rankedLabels(query: string): string[] {
    return CommandSearchMatcher.rank(query, items).map((item) => item.label);
  }

  it('keeps every command in the given order for a blank query', () => {
    expect(rankedLabels('   ')).toEqual(items.map((item) => item.label));
  });

  it('ranks label prefixes above later word prefixes and keeps shorter labels first', () => {
    expect(rankedLabels('sel')).toEqual(['Select All', 'Hide Selected']);
    expect(rankedLabels('save')).toEqual(['Save', 'Save As\u2026']);
  });

  it('finds commands by their menu title and needs every word to match', () => {
    expect(rankedLabels('csg')).toEqual(['Union', 'Subtract']);
    expect(rankedLabels('csg union')).toEqual(['Union']);
    expect(rankedLabels('csg nothing')).toEqual([]);
  });

  it('finds commands by letters in order as the weakest match', () => {
    expect(rankedLabels('sbtr')).toEqual(['Subtract']);
  });

  it('ignores the trailing ellipsis of dialog commands', () => {
    expect(rankedLabels('as\u2026')).toEqual([]);
    expect(rankedLabels('save as')).toEqual(['Save As\u2026']);
  });
});
