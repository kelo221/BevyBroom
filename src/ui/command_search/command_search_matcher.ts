import type { CommandSearchItem } from '@/ui/command_search/command_search_item.js';

/** Score of a query word the label starts with. */
const COMMAND_SEARCH_SCORE_LABEL_PREFIX = 100;

/** Score of a query word a later word of the label starts with. */
const COMMAND_SEARCH_SCORE_LABEL_WORD_PREFIX = 80;

/** Score of a query word found inside the label. */
const COMMAND_SEARCH_SCORE_LABEL_CONTAINS = 60;

/** Score of a query word found in a menu title of the path. */
const COMMAND_SEARCH_SCORE_PATH_CONTAINS = 30;

/** Score of a query word whose letters appear in order in the label. */
const COMMAND_SEARCH_SCORE_LABEL_LETTERS = 10;

/** A command with its score for one query. */
interface CommandSearchScoredItem {
  readonly item: CommandSearchItem;
  readonly score: number;
  readonly order: number;
}

/**
 * Ranks commands for a typed query. Every query word must match the label or a
 * menu title; matches at the start of the label rank highest, then at the start
 * of a label word, inside the label, inside a menu title, and last as letters
 * in order. Equal scores keep the shorter label first, then menu order.
 */
export class CommandSearchMatcher {
  /**
   * Returns the commands matching a query, best first.
   *
   * @param query Typed query; blank matches every command in menu order.
   * @param items Commands in menu order.
   * @returns Matching commands.
   */
  static rank(query: string, items: readonly CommandSearchItem[]): CommandSearchItem[] {
    const words = CommandSearchMatcher.queryWordsRead(query);
    if (words.length === 0) {
      return [...items];
    }
    const scoredItems: CommandSearchScoredItem[] = [];
    items.forEach((item, order) => {
      const score = CommandSearchMatcher.itemScore(words, item);
      if (score > 0) {
        scoredItems.push({ item, score, order });
      }
    });
    return scoredItems.sort(CommandSearchMatcher.scoredItemsCompare).map((scored) => scored.item);
  }

  /**
   * Splits a query into lower-case words.
   *
   * @param query Typed query.
   * @returns Words, empty for a blank query.
   */
  private static queryWordsRead(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Scores a command for every query word.
   *
   * @param words Lower-case query words.
   * @param item Command.
   * @returns Summed score, or 0 when a word does not match.
   */
  private static itemScore(words: readonly string[], item: CommandSearchItem): number {
    const label = CommandSearchMatcher.textNormalize(item.label);
    const path = CommandSearchMatcher.textNormalize(item.path.join(' '));
    let total = 0;
    for (const word of words) {
      const score = CommandSearchMatcher.wordScore(word, label, path);
      if (score === 0) {
        return 0;
      }
      total += score;
    }
    return total;
  }

  /**
   * Scores one query word against a label and its menu path.
   *
   * @param word Lower-case query word.
   * @param label Lower-case label.
   * @param path Lower-case menu titles.
   * @returns Score, or 0 when the word does not match.
   */
  private static wordScore(word: string, label: string, path: string): number {
    if (label.startsWith(word)) {
      return COMMAND_SEARCH_SCORE_LABEL_PREFIX;
    }
    if (label.split(' ').some((labelWord) => labelWord.startsWith(word))) {
      return COMMAND_SEARCH_SCORE_LABEL_WORD_PREFIX;
    }
    if (label.includes(word)) {
      return COMMAND_SEARCH_SCORE_LABEL_CONTAINS;
    }
    if (path.includes(word)) {
      return COMMAND_SEARCH_SCORE_PATH_CONTAINS;
    }
    return CommandSearchMatcher.lettersInOrderAre(word, label) ? COMMAND_SEARCH_SCORE_LABEL_LETTERS : 0;
  }

  /**
   * Returns whether every letter of a word appears in a text in the same order.
   *
   * @param word Lower-case word.
   * @param text Lower-case text.
   * @returns True when the letters appear in order.
   */
  private static lettersInOrderAre(word: string, text: string): boolean {
    let textIndex = 0;
    for (const letter of word) {
      textIndex = text.indexOf(letter, textIndex);
      if (textIndex < 0) {
        return false;
      }
      textIndex += 1;
    }
    return true;
  }

  /**
   * Lower-cases a text and drops the trailing ellipsis of dialog commands.
   *
   * @param text Label or path text.
   * @returns Normalized text.
   */
  private static textNormalize(text: string): string {
    return text.toLowerCase().replace(/\u2026|\.\.\./g, '');
  }

  /**
   * Orders scored commands: higher score, then shorter label, then menu order.
   *
   * @param first First scored command.
   * @param second Second scored command.
   * @returns Sort order.
   */
  private static scoredItemsCompare(first: CommandSearchScoredItem, second: CommandSearchScoredItem): number {
    return (
      second.score - first.score || first.item.label.length - second.item.label.length || first.order - second.order
    );
  }
}
