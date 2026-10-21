import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import type { EntityBrowserViewOptions } from '@/entity_browser/view/entity_browser_view_options.js';

/** Tiles shown together, under a category header or as one flat list. */
export interface EntityBrowserViewGroup {
  /** Category header text, or null for the single ungrouped list. */
  readonly title: string | null;
  /** Entries in display order. */
  readonly entries: readonly EntityBrowserCatalogEntry[];
}

/** Turns the catalog into the tiles the browser shows for its display choices. */
export class EntityBrowserViewQuery {
  /**
   * Filters, sorts and groups the catalog.
   *
   * @param entries Catalog entries.
   * @param options Display choices.
   * @param usageCounts Instance count by entry id.
   * @returns Groups in display order; empty groups are left out.
   */
  static groupsResolve(
    entries: readonly EntityBrowserCatalogEntry[],
    options: EntityBrowserViewOptions,
    usageCounts: ReadonlyMap<string, number>,
  ): EntityBrowserViewGroup[] {
    const visible = EntityBrowserViewQuery.entriesFilter(entries, options, usageCounts);
    const sorted = EntityBrowserViewQuery.entriesSort(visible, options);
    if (!options.groupByCategory) {
      return sorted.length === 0 ? [] : [{ title: null, entries: sorted }];
    }
    return EntityBrowserViewQuery.entriesGroupByCategory(sorted);
  }

  /**
   * Keeps the entries matching the search text and, when asked, the used ones.
   *
   * @param entries Catalog entries.
   * @param options Display choices.
   * @param usageCounts Instance count by entry id.
   * @returns Visible entries in catalog order.
   */
  static entriesFilter(
    entries: readonly EntityBrowserCatalogEntry[],
    options: EntityBrowserViewOptions,
    usageCounts: ReadonlyMap<string, number>,
  ): EntityBrowserCatalogEntry[] {
    const search = options.searchText.trim().toLowerCase();
    return entries.filter((entry) => {
      if (search !== '' && !entry.label.toLowerCase().includes(search)) {
        return false;
      }
      return !options.usedOnly || (usageCounts.get(entry.id) ?? 0) > 0;
    });
  }

  /**
   * Sorts entries by name, or by category then name.
   *
   * @param entries Entries to sort; not modified.
   * @param options Display choices.
   * @returns Sorted copy.
   */
  static entriesSort(
    entries: readonly EntityBrowserCatalogEntry[],
    options: EntityBrowserViewOptions,
  ): EntityBrowserCatalogEntry[] {
    const byCategory = options.sortMode === 'category';
    return [...entries].sort((first, second) => {
      if (byCategory && first.categoryIndex !== second.categoryIndex) {
        return first.categoryIndex - second.categoryIndex;
      }
      return EntityBrowserViewQuery.entriesCompareByName(first, second);
    });
  }

  /**
   * Compares two entries by name, case-insensitively, then by catalog order.
   *
   * @param first First entry.
   * @param second Second entry.
   * @returns Negative, zero or positive sort order.
   */
  private static entriesCompareByName(first: EntityBrowserCatalogEntry, second: EntityBrowserCatalogEntry): number {
    const byName = first.label.localeCompare(second.label, undefined, { sensitivity: 'base' });
    return byName !== 0 ? byName : first.catalogIndex - second.catalogIndex;
  }

  /**
   * Splits sorted entries into one group per category, in category order.
   *
   * @param sortedEntries Entries in display order.
   * @returns Groups headed by their category.
   */
  private static entriesGroupByCategory(sortedEntries: readonly EntityBrowserCatalogEntry[]): EntityBrowserViewGroup[] {
    const groups = new Map<string, { categoryIndex: number; entries: EntityBrowserCatalogEntry[] }>();
    for (const entry of sortedEntries) {
      const group = groups.get(entry.category) ?? { categoryIndex: entry.categoryIndex, entries: [] };
      group.entries.push(entry);
      groups.set(entry.category, group);
    }
    return [...groups]
      .sort(([, first], [, second]) => first.categoryIndex - second.categoryIndex)
      .map(([title, group]) => ({ title, entries: group.entries }));
  }
}
