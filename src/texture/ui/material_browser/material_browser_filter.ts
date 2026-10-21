import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/**
 * Returns the entries whose name or relative path contains every word of the
 * filter text, ignoring case. An empty filter keeps every entry.
 *
 * @param entries Materials to filter.
 * @param filterText Text typed into the filter field.
 * @returns Matching entries in their original order.
 */
export function materialBrowserFilterEntries(
  entries: readonly TextureBrowserEntry[],
  filterText: string,
): TextureBrowserEntry[] {
  const words = materialBrowserFilterWords(filterText);
  if (words.length === 0) {
    return entries.slice();
  }
  return entries.filter((entry) => materialBrowserFilterEntryMatches(entry, words));
}

/**
 * Splits filter text into lowercase words.
 *
 * @param filterText Text typed into the filter field.
 * @returns Non-empty lowercase words.
 */
function materialBrowserFilterWords(filterText: string): string[] {
  return filterText
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Returns whether every word occurs in the entry's name or relative path.
 *
 * @param entry Material entry.
 * @param words Lowercase filter words.
 * @returns True when the entry matches all words.
 */
function materialBrowserFilterEntryMatches(entry: TextureBrowserEntry, words: readonly string[]): boolean {
  const haystack = `${entry.displayName}\n${entry.relativePath}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}
