/** Tells whether the items of a toolbar row need more width than the row has. */
export interface ToolbarOverflowMeasure {
  /**
   * Returns whether the row content is wider than the row.
   *
   * @param row Toolbar row element.
   * @returns True when items would be cut off.
   */
  rowIsOverflowing(row: HTMLElement): boolean;
}

/** Measures toolbar rows through their laid-out scroll and client widths. */
export class ToolbarOverflowMeasureDom implements ToolbarOverflowMeasure {
  /**
   * Returns whether the row content is wider than the row, ignoring sub-pixel
   * rounding.
   *
   * @param row Toolbar row element.
   * @returns True when items would be cut off.
   */
  rowIsOverflowing(row: HTMLElement): boolean {
    return row.scrollWidth > row.clientWidth + 1;
  }
}
