import { inputNumericFormatWithMinimumDecimals } from '@/ui/input/input_numeric_parse.js';

/**
 * Formats a grid size for menus and the toolbar, such as "Grid 0.25".
 *
 * @param interval Grid size in meters.
 * @returns Grid size label.
 */
export function formatGridIntervalLabel(interval: number): string {
  return `Grid ${inputNumericFormatWithMinimumDecimals(interval, 1)}`;
}
