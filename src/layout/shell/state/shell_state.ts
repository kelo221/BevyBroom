/** Saved arrangement of the main window panels. */
export interface ShellState {
  /** True while the right-hand inspector is shown. */
  inspectorVisible: boolean;
  /** Inspector width in CSS pixels. */
  inspectorWidthPx: number;
  /** True while the bottom info panel is shown. */
  infoPanelVisible: boolean;
  /** Info panel height in CSS pixels. */
  infoPanelHeightPx: number;
  /** Id of the visible info panel tab. */
  infoPanelTabId: string;
  /** True while the main icon toolbar is shown. */
  toolbarVisible: boolean;
  /** True while the left vertical tools palette is shown. */
  toolsPaletteVisible: boolean;
  /** Sizes of inner splitters in CSS pixels, keyed by splitter name. */
  splitSizesPx: Record<string, number>;
}

/** Smallest inspector width in CSS pixels. */
export const SHELL_INSPECTOR_MIN_WIDTH_PX = 350;

/** Smallest info panel height in CSS pixels. */
export const SHELL_INFO_PANEL_MIN_HEIGHT_PX = 100;

/**
 * Returns the arrangement used before the user changed anything.
 *
 * @returns Default shell state.
 */
export function shellStateDefaultCreate(): ShellState {
  return {
    inspectorVisible: true,
    inspectorWidthPx: SHELL_INSPECTOR_MIN_WIDTH_PX,
    infoPanelVisible: true,
    infoPanelHeightPx: 120,
    infoPanelTabId: 'console',
    toolbarVisible: true,
    toolsPaletteVisible: true,
    splitSizesPx: {},
  };
}
