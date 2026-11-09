import type { SprinklePlacementMode } from '@/tools/sprinkle/sprinkle_types.js';

/**
 * What each Sprinkle placement mode does inside the brush:
 *
 * - ADDITIVE places into grid cells and replaces the sprinkled entity a cell
 *   held.
 * - SUBTRACTIVE removes every sprinkled entity inside the brush.
 * - REPLACE removes every sprinkled entity inside the brush that the stroke did
 *   not place, then places like ADDITIVE.
 * - OVERWRITE places like ADDITIVE, but only into cells that already hold a
 *   sprinkled entity.
 */
export class SprinklePlacementModeRules {
  /**
   * Returns whether a mode removes the sprinkled entities inside the brush
   * before placing.
   *
   * @param mode Placement mode.
   * @returns True for SUBTRACTIVE and REPLACE.
   */
  static brushClearIs(mode: SprinklePlacementMode): boolean {
    return mode === 'SUBTRACTIVE' || mode === 'REPLACE';
  }

  /**
   * Returns whether a mode places entities into grid cells.
   *
   * @param mode Placement mode.
   * @returns False for SUBTRACTIVE only.
   */
  static placesIs(mode: SprinklePlacementMode): boolean {
    return mode !== 'SUBTRACTIVE';
  }

  /**
   * Returns whether a mode may place into a cell.
   *
   * @param mode Placement mode.
   * @param isCellOccupied Whether the cell holds a sprinkled entity.
   * @returns True when the mode places and, for OVERWRITE, the cell is
   *   occupied.
   */
  static cellPlacementAllowedIs(mode: SprinklePlacementMode, isCellOccupied: boolean): boolean {
    if (!SprinklePlacementModeRules.placesIs(mode)) {
      return false;
    }
    return mode !== 'OVERWRITE' || isCellOccupied;
  }

  /**
   * Returns the mode a press uses: Ctrl turns any mode into SUBTRACTIVE.
   *
   * @param configuredMode Mode chosen in the configuration.
   * @param isCtrlDown Whether Ctrl is held at the press.
   * @returns Mode of the stroke.
   */
  static pressModeResolve(configuredMode: SprinklePlacementMode, isCtrlDown: boolean): SprinklePlacementMode {
    return isCtrlDown ? 'SUBTRACTIVE' : configuredMode;
  }
}
