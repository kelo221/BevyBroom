/** Order of the tiles: by name, or by category then name. */
export type EntityBrowserSortMode = 'name' | 'category';

/** Display choices of the entity browser. */
export interface EntityBrowserViewOptions {
  /** Tile order. */
  readonly sortMode: EntityBrowserSortMode;
  /** True to show tiles under category headers. */
  readonly groupByCategory: boolean;
  /** True to show only kinds used in the current map. */
  readonly usedOnly: boolean;
  /** Case-insensitive name filter; empty shows every tile. */
  readonly searchText: string;
}

/** Display choices of a browser that was never configured. */
export const ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT: EntityBrowserViewOptions = Object.freeze({
  sortMode: 'category',
  groupByCategory: true,
  usedOnly: false,
  searchText: '',
});

/**
 * Builds valid display choices from untrusted data, keeping defaults for
 * missing or malformed fields.
 *
 * @param value Parsed stored value.
 * @returns Valid display choices.
 */
export function entityBrowserViewOptionsSanitize(value: unknown): EntityBrowserViewOptions {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const defaults = ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT;
  return {
    sortMode:
      record['sortMode'] === 'name' || record['sortMode'] === 'category' ? record['sortMode'] : defaults.sortMode,
    groupByCategory: entityBrowserViewOptionsBoolean(record['groupByCategory'], defaults.groupByCategory),
    usedOnly: entityBrowserViewOptionsBoolean(record['usedOnly'], defaults.usedOnly),
    searchText: typeof record['searchText'] === 'string' ? record['searchText'] : defaults.searchText,
  };
}

/**
 * Returns a stored boolean, or a fallback when the value is not a boolean.
 *
 * @param value Stored value.
 * @param fallback Value used when the stored one is invalid.
 * @returns Boolean value.
 */
function entityBrowserViewOptionsBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
