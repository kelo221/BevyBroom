/** World position read by the status bar cursor readout, in meters. */
export interface StatusCursorWorldPosition {
  x: number;
  y: number;
  z: number;
}

/** Text shown when the cursor is not over a viewport. */
export const STATUS_CURSOR_COORDS_EMPTY_TEXT = '—';

/** Text shown when nothing is selected. */
export const STATUS_SELECTION_EMPTY_TEXT = 'no selection.';

/** Decimal places used for cursor coordinates. */
const STATUS_CURSOR_COORD_DECIMALS = 2;

/**
 * Formats a cursor world position as "@ (x, y, z)" in meters, or the empty
 * marker when there is no position.
 *
 * @param position World position, or null when the cursor is off every
 *   viewport.
 * @returns Formatted readout text.
 */
export function statusCursorCoordsFormat(position: StatusCursorWorldPosition | null): string {
  if (position === null) {
    return STATUS_CURSOR_COORDS_EMPTY_TEXT;
  }
  const parts = [position.x, position.y, position.z].map(statusCursorCoordFormat);
  return `@ (${parts.join(', ')})`;
}

/**
 * Formats one coordinate with fixed decimals, writing negative zero as zero.
 *
 * @param value Coordinate in meters.
 * @returns Formatted coordinate.
 */
function statusCursorCoordFormat(value: number): string {
  const text = value.toFixed(STATUS_CURSOR_COORD_DECIMALS);
  return Number(text) === 0 ? (0).toFixed(STATUS_CURSOR_COORD_DECIMALS) : text;
}

/**
 * Formats the selection readout from an object count and an optional
 * description that replaces the default wording when something is selected.
 *
 * @param count Number of selected objects.
 * @param description Optional custom text used when the count is above zero.
 * @returns Selection readout text.
 */
export function statusSelectionFormat(count: number, description?: string): string {
  if (count <= 0) {
    return STATUS_SELECTION_EMPTY_TEXT;
  }
  if (description !== undefined && description !== '') {
    return description;
  }
  return count === 1 ? '1 object selected' : `${count} objects selected`;
}
