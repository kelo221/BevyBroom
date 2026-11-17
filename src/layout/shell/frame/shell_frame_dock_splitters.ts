import { SplitterBox, type SplitterBoxOptions } from '@/ui/splitter/splitter_box.js';
import type { DockSide } from '@/ui/dock/dock_side.js';
import type { DockManagerFrame } from '@/ui/dock/manager/dock_manager.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';

/** Splitter state key of each dock's size. */
export const SHELL_FRAME_DOCK_SPLIT_KEYS: Readonly<Record<DockSide, string>> = {
  left: 'dock_left',
  right: 'dock_right',
  bottom: 'dock_bottom',
};

/** Starting size of each dock in CSS pixels. */
const SHELL_FRAME_DOCK_DEFAULT_SIZES_PX: Readonly<Record<DockSide, number>> = {
  left: 360,
  right: 360,
  bottom: 260,
};

/** Smallest size of a side dock in CSS pixels. */
const SHELL_FRAME_DOCK_SIDE_MIN_PX = 160;

/** Smallest size of the bottom dock in CSS pixels. */
const SHELL_FRAME_DOCK_BOTTOM_MIN_PX = 90;

/** Smallest width left to the map views beside the side docks in CSS pixels. */
const SHELL_FRAME_DOCK_VIEWS_MIN_WIDTH_PX = 320;

/** Smallest height left to the map views above the bottom dock in CSS pixels. */
const SHELL_FRAME_DOCK_VIEWS_MIN_HEIGHT_PX = 120;

/**
 * The three tool window docks of the main window, each a resizable splitter
 * pane hidden while empty: left of the map views, right of them (left of the
 * inspector), and below them (above the info panel). Dock sizes are kept in the
 * shell state store.
 */
export class ShellFrameDockSplitters implements DockManagerFrame {
  private readonly stateStore: ShellStateStore;
  private readonly splitters: Record<DockSide, SplitterBox>;

  /**
   * Creates the three nested dock splitters.
   *
   * @param stateStore Store that keeps the dock sizes.
   */
  constructor(stateStore: ShellStateStore) {
    this.stateStore = stateStore;
    this.splitters = {
      left: this.splitterCreate('left', { orientation: 'horizontal', sizedPane: 'first' }),
      right: this.splitterCreate('right', { orientation: 'horizontal', sizedPane: 'second' }),
      bottom: this.splitterCreate('bottom', { orientation: 'vertical', sizedPane: 'second' }),
    };
    this.splittersNest();
  }

  /**
   * Returns the outer element holding the docks around the map views and info
   * panel.
   *
   * @returns Dock area element.
   */
  dockAreaRead(): HTMLElement {
    return this.splitters.left.getElement();
  }

  /**
   * Returns the pane holding the dock of an edge.
   *
   * @param side Dock edge.
   * @returns Dock pane.
   */
  dockPaneRead(side: DockSide): HTMLElement {
    const splitter = this.splitters[side];
    return side === 'left' ? splitter.getFirstPane() : splitter.getSecondPane();
  }

  /**
   * Shows or hides the pane of an edge's dock.
   *
   * @param side Dock edge.
   * @param isVisible True to show it.
   */
  dockPaneVisibleSet(side: DockSide, isVisible: boolean): void {
    this.splitters[side].setSizedPaneCollapsed(!isVisible);
  }

  /**
   * Returns whether the dock of an edge is shown.
   *
   * @param side Dock edge.
   * @returns True while shown.
   */
  isDockPaneVisible(side: DockSide): boolean {
    return !this.splitters[side].isSizedPaneCollapsed();
  }

  /**
   * Returns the pane that receives the map views and info panel: inside the
   * side docks.
   *
   * @returns Center pane of the side docks.
   */
  centerPaneRead(): HTMLElement {
    return this.splitters.right.getFirstPane();
  }

  /**
   * Returns the pane that receives the map views: above the bottom dock.
   *
   * @returns Views pane.
   */
  viewsPaneRead(): HTMLElement {
    return this.splitters.bottom.getFirstPane();
  }

  /**
   * Returns the element holding the map views and the bottom dock, placed above
   * the info panel.
   *
   * @returns Bottom dock splitter element.
   */
  viewsAndBottomDockRead(): HTMLElement {
    return this.splitters.bottom.getElement();
  }

  /** Removes the dock splitters and their listeners. */
  dispose(): void {
    Object.values(this.splitters).forEach((splitter) => splitter.dispose());
  }

  /**
   * Creates the splitter of one dock with its saved size, starting hidden.
   *
   * @param side Dock edge.
   * @param layout Orientation and sized pane.
   * @returns Splitter.
   */
  private splitterCreate(side: DockSide, layout: Pick<SplitterBoxOptions, 'orientation' | 'sizedPane'>): SplitterBox {
    const isBottom = side === 'bottom';
    const splitKey = SHELL_FRAME_DOCK_SPLIT_KEYS[side];
    const splitter = new SplitterBox({
      ...layout,
      initialSizePx: this.stateStore.splitSizeRead(splitKey, SHELL_FRAME_DOCK_DEFAULT_SIZES_PX[side]),
      minSizedPx: isBottom ? SHELL_FRAME_DOCK_BOTTOM_MIN_PX : SHELL_FRAME_DOCK_SIDE_MIN_PX,
      minFlexiblePx: isBottom ? SHELL_FRAME_DOCK_VIEWS_MIN_HEIGHT_PX : SHELL_FRAME_DOCK_VIEWS_MIN_WIDTH_PX,
    });
    splitter.getElement().classList.add(`shell-dock-splitter-${side}`);
    splitter.setSizedPaneCollapsed(true);
    splitter.changeListenerAdd((sizePx) => this.stateStore.splitSizeWrite(splitKey, sizePx));
    return splitter;
  }

  /** Nests the right dock inside the left dock's flexible pane. */
  private splittersNest(): void {
    this.splitters.left.getSecondPane().appendChild(this.splitters.right.getElement());
  }
}
