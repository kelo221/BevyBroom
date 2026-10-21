import { shellStateDefaultCreate, type ShellState } from './shell_state.js';

/**
 * Builds a valid shell state from parsed storage JSON, using defaults for
 * missing or malformed fields.
 *
 * @param value Parsed JSON of unknown shape.
 * @returns Complete shell state.
 */
export function shellStateSanitize(value: unknown): ShellState {
  const defaults = shellStateDefaultCreate();
  if (typeof value !== 'object' || value === null) {
    return defaults;
  }
  const record = value as Record<string, unknown>;
  return {
    inspectorVisible: shellStateBooleanRead(record['inspectorVisible'], defaults.inspectorVisible),
    inspectorWidthPx: shellStatePixelsRead(record['inspectorWidthPx'], defaults.inspectorWidthPx),
    inspectorTabId: shellStateStringRead(record['inspectorTabId'], defaults.inspectorTabId),
    infoPanelVisible: shellStateBooleanRead(record['infoPanelVisible'], defaults.infoPanelVisible),
    infoPanelHeightPx: shellStatePixelsRead(record['infoPanelHeightPx'], defaults.infoPanelHeightPx),
    infoPanelTabId: shellStateStringRead(record['infoPanelTabId'], defaults.infoPanelTabId),
    toolbarVisible: shellStateBooleanRead(record['toolbarVisible'], defaults.toolbarVisible),
    splitSizesPx: shellStateSplitSizesRead(record['splitSizesPx']),
  };
}

/**
 * Reads a boolean field.
 *
 * @param value Stored value.
 * @param fallback Value used when the stored one is not a boolean.
 * @returns Boolean value.
 */
function shellStateBooleanRead(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reads a positive pixel size.
 *
 * @param value Stored value.
 * @param fallback Value used when the stored one is not a positive finite
 *   number.
 * @returns Pixel size.
 */
function shellStatePixelsRead(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Reads a non-empty string.
 *
 * @param value Stored value.
 * @param fallback Value used when the stored one is not a non-empty string.
 * @returns String value.
 */
function shellStateStringRead(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Reads the inner splitter sizes, keeping only positive finite numbers.
 *
 * @param value Stored value.
 * @returns Splitter sizes keyed by splitter name.
 */
function shellStateSplitSizesRead(value: unknown): Record<string, number> {
  const sizes: Record<string, number> = {};
  if (typeof value !== 'object' || value === null) {
    return sizes;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, size]) => {
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
      sizes[key] = size;
    }
  });
  return sizes;
}
