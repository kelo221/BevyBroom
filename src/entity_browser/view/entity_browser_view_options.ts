/** Order of the tiles: by name, or by category then name. */
export type EntityBrowserSortMode = 'name' | 'category';

/**
 * How the browser shows its kinds: icon tiles, tiles showing each kind's meshes
 * rendered in 3D, or one large orbitable 3D tile of the selected kind above the
 * tile grid.
 */
export type EntityBrowserViewMode = 'icons' | 'tiles_3d' | 'single_3d';

/** Every view mode in menu order. */
export const ENTITY_BROWSER_VIEW_MODES: readonly EntityBrowserViewMode[] = ['icons', 'tiles_3d', 'single_3d'];

/** Display choices of the entity browser. */
export interface EntityBrowserViewOptions {
  /** Tile order. */
  readonly sortMode: EntityBrowserSortMode;
  /** True to show tiles under category headers. */
  readonly groupByCategory: boolean;
  /** True to show only kinds used in the current map. */
  readonly usedOnly: boolean;
  /** Case-insensitive name or category filter; empty shows every tile. */
  readonly searchText: string;
  /** Top-level category whose tiles are shown; empty shows every category. */
  readonly categoryFilter: string;
  /** How the kinds are shown. */
  readonly viewMode: EntityBrowserViewMode;
}

/** Display choices of a browser that was never configured. */
export const ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT: EntityBrowserViewOptions = Object.freeze({
  sortMode: 'category',
  groupByCategory: true,
  usedOnly: false,
  searchText: '',
  categoryFilter: '',
  viewMode: 'tiles_3d',
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
    categoryFilter: typeof record['categoryFilter'] === 'string' ? record['categoryFilter'] : defaults.categoryFilter,
    viewMode: entityBrowserViewModeSanitize(record['viewMode'], defaults.viewMode),
  };
}

/**
 * Returns a stored view mode, or a fallback when the value is not a known mode.
 *
 * @param value Stored value.
 * @param fallback Mode used when the stored one is invalid.
 * @returns View mode.
 */
export function entityBrowserViewModeSanitize(value: unknown, fallback: EntityBrowserViewMode): EntityBrowserViewMode {
  return ENTITY_BROWSER_VIEW_MODES.find((viewMode) => viewMode === value) ?? fallback;
}

/**
 * Returns whether a view mode draws kinds with their 3D meshes.
 *
 * @param viewMode View mode.
 * @returns True for the 3D tile and single 3D tile modes.
 */
export function entityBrowserViewModeIs3d(viewMode: EntityBrowserViewMode): boolean {
  return viewMode !== 'icons';
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
