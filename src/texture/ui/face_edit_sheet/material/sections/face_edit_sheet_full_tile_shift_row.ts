import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';

/** Label and whole-tile shift (tiles U, tiles V) of every Tile button. */
const FACE_EDIT_SHEET_FULL_TILE_SHIFTS: ReadonlyArray<readonly [string, number, number]> = [
  ['Tile -U', -1, 0],
  ['Tile +U', 1, 0],
  ['Tile -V', 0, -1],
  ['Tile +V', 0, 1],
];

/**
 * Creates the strip of Tile -U / +U / -V / +V buttons that shift UVs by one
 * whole tile.
 *
 * @param onShiftFullTile Shifts UVs by whole tiles along U and V.
 * @returns Row element.
 */
export function faceEditSheetFullTileShiftRowCreate(
  onShiftFullTile: (tilesU: number, tilesV: number) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'face-edit-sheet-full-tile-shift-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = 'repeat(4, 1fr)';
  row.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
  FACE_EDIT_SHEET_FULL_TILE_SHIFTS.forEach(([text, tilesU, tilesV]) => {
    const onClick = () => onShiftFullTile(tilesU, tilesV);
    row.append(
      buttonCompactCreate({
        title: text,
        text,
        widthPx: null,
        heightPx: FACE_INSPECTOR_METRICS.controlHeight,
        onClick,
      }),
    );
  });
  return row;
}
