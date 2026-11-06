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

/** Text of the help field while no action message is shown. */
export const STATUS_HELP_IDLE_TEXT = 'For Help, press F1';

/** Text of the zoom field while no 2D view zoom is known. */
const STATUS_ZOOM_EMPTY_TEXT = 'Zoom: —';

/** Decimal places used for cursor coordinates. */
const STATUS_CURSOR_COORD_DECIMALS = 2;

/** Decimal places used for the 2D view zoom factor. */
const STATUS_ZOOM_DECIMALS = 2;

/**
 * Formats the snap field as "Snap: On Grid: 0.25".
 *
 * @param enabled Whether grid snapping is on.
 * @param intervalText Formatted grid interval.
 * @returns Snap field text.
 */
export function statusSnapFormat(enabled: boolean, intervalText: string): string {
  return `Snap: ${enabled ? 'On' : 'Off'} Grid: ${intervalText}`;
}

/**
 * Formats the zoom field of the 2D views as "Zoom: 1.50".
 *
 * @param zoom Zoom factor where 1 is the startup framing, or null when unknown.
 * @returns Zoom field text.
 */
export function statusZoomFormat(zoom: number | null): string {
  if (zoom === null || !Number.isFinite(zoom)) {
    return STATUS_ZOOM_EMPTY_TEXT;
  }
  return `Zoom: ${zoom.toFixed(STATUS_ZOOM_DECIMALS)}`;
}

/**
 * Formats the help field tooltip: one line per non-empty part.
 *
 * @param parts Tooltip lines such as the undo counts and the save state.
 * @returns Tooltip text.
 */
export function statusTooltipFormat(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join('\n');
}

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
