import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { SplitterBox } from '@/ui/splitter/splitter_box.js';
import {
  SHELL_INFO_PANEL_MIN_HEIGHT_PX,
  SHELL_INSPECTOR_MIN_WIDTH_PX,
  type ShellState,
} from '@/layout/shell/state/shell_state.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';

/** Smallest width of the map views next to the inspector in CSS pixels. */
const SHELL_FRAME_VIEWS_MIN_WIDTH_PX = 320;

/** Smallest height of the map views above the info panel in CSS pixels. */
const SHELL_FRAME_VIEWS_MIN_HEIGHT_PX = 160;

/** Listener told that a dock was shown or hidden. */
export type ShellFrameVisibilityListener = () => void;

/**
 * Main window skeleton: a menu bar row, a toolbar row, the map views with a
 * view bar above them and the info panel below them, and the inspector on the
 * right. Dock sizes and visibility are kept in the shell state store.
 */
export class ShellFrame {
  private readonly root: HTMLElement;
  private readonly stateStore: ShellStateStore;
  private readonly menuBarHost: HTMLElement;
  private readonly toolbarHost: HTMLElement;
  private readonly inspectorSplitter: SplitterBox;
  private readonly infoPanelSplitter: SplitterBox;
  private readonly viewColumn: HTMLElement;
  private readonly viewBar: HTMLElement;
  private readonly viewBarToolSlot: HTMLElement;
  private readonly viewBarWorkspaceSlot: HTMLElement;
  private readonly visibilityListeners: Set<ShellFrameVisibilityListener>;

  /**
   * Builds the skeleton under the editor container and restores saved dock
   * sizes and visibility.
   *
   * @param editorContainer Root element that receives the main window.
   * @param stateStore Store that keeps dock sizes and visibility.
   */
  constructor(editorContainer: HTMLElement, stateStore: ShellStateStore) {
    this.stateStore = stateStore;
    this.visibilityListeners = new Set();
    this.root = this.rootCreate(editorContainer);
    this.menuBarHost = this.rowCreate('shell-menu-bar-host');
    this.toolbarHost = this.rowCreate('shell-toolbar-host');
    this.inspectorSplitter = this.inspectorSplitterCreate(stateStore.getState());
    this.infoPanelSplitter = this.infoPanelSplitterCreate(stateStore.getState());
    this.viewBar = this.viewBarCreate();
    this.viewBarToolSlot = this.viewBarSlotCreate('shell-view-bar-tool-slot', '1 1 auto');
    this.viewBarWorkspaceSlot = this.viewBarSlotCreate('shell-view-bar-workspace-slot', '0 0 auto');
    this.viewColumn = this.viewColumnCreate();
    this.splittersMount();
    this.visibilityRestore(stateStore.getState());
  }

  /**
   * Returns the main window root column.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the row that holds the menu bar.
   *
   * @returns Menu bar host.
   */
  menuBarHostRead(): HTMLElement {
    return this.menuBarHost;
  }

  /**
   * Returns the row that holds the main toolbar.
   *
   * @returns Toolbar host.
   */
  toolbarHostRead(): HTMLElement {
    return this.toolbarHost;
  }

  /**
   * Returns the column that holds the view bar and the map views.
   *
   * @returns View column.
   */
  viewColumnRead(): HTMLElement {
    return this.viewColumn;
  }

  /**
   * Returns the part of the view bar that holds the tool options.
   *
   * @returns Tool options slot.
   */
  viewBarToolSlotRead(): HTMLElement {
    return this.viewBarToolSlot;
  }

  /**
   * Returns the part of the view bar that holds the workspace tabs.
   *
   * @returns Workspace tabs slot.
   */
  viewBarWorkspaceSlotRead(): HTMLElement {
    return this.viewBarWorkspaceSlot;
  }

  /**
   * Returns the pane that holds the inspector.
   *
   * @returns Inspector pane.
   */
  inspectorHostRead(): HTMLElement {
    return this.inspectorSplitter.getSecondPane();
  }

  /**
   * Returns the pane that holds the info panel.
   *
   * @returns Info panel pane.
   */
  infoPanelHostRead(): HTMLElement {
    return this.infoPanelSplitter.getSecondPane();
  }

  /**
   * Returns whether the inspector is shown.
   *
   * @returns True while shown.
   */
  isInspectorVisible(): boolean {
    return !this.inspectorSplitter.isSizedPaneCollapsed();
  }

  /**
   * Shows or hides the inspector and remembers the choice.
   *
   * @param visible True to show it.
   */
  inspectorVisibleSet(visible: boolean): void {
    this.inspectorSplitter.setSizedPaneCollapsed(!visible);
    this.stateStore.update({ inspectorVisible: visible });
    this.visibilityListenersNotify();
  }

  /**
   * Returns whether the info panel is shown.
   *
   * @returns True while shown.
   */
  isInfoPanelVisible(): boolean {
    return !this.infoPanelSplitter.isSizedPaneCollapsed();
  }

  /**
   * Shows or hides the info panel and remembers the choice.
   *
   * @param visible True to show it.
   */
  infoPanelVisibleSet(visible: boolean): void {
    this.infoPanelSplitter.setSizedPaneCollapsed(!visible);
    this.stateStore.update({ infoPanelVisible: visible });
    this.visibilityListenersNotify();
  }

  /**
   * Returns whether the main toolbar is shown.
   *
   * @returns True while shown.
   */
  isToolbarVisible(): boolean {
    return this.toolbarHost.style.display !== 'none';
  }

  /**
   * Shows or hides the main toolbar and remembers the choice.
   *
   * @param visible True to show it.
   */
  toolbarVisibleSet(visible: boolean): void {
    this.toolbarHost.style.display = visible ? 'flex' : 'none';
    this.stateStore.update({ toolbarVisible: visible });
    this.visibilityListenersNotify();
  }

  /**
   * Registers a listener told whenever a dock or the toolbar is shown or
   * hidden.
   *
   * @param listener Called after the change.
   * @returns Function that removes the listener.
   */
  visibilityListenerAdd(listener: ShellFrameVisibilityListener): () => void {
    this.visibilityListeners.add(listener);
    return () => {
      this.visibilityListeners.delete(listener);
    };
  }

  /** Removes the main window from the document. */
  dispose(): void {
    this.visibilityListeners.clear();
    this.infoPanelSplitter.dispose();
    this.inspectorSplitter.dispose();
    this.root.remove();
  }

  /**
   * Creates the root column inside the editor container.
   *
   * @param editorContainer Root element that receives the main window.
   * @returns Root column.
   */
  private rootCreate(editorContainer: HTMLElement): HTMLElement {
    const root = document.createElement('div');
    root.classList.add('shell-frame');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.width = '100%';
    root.style.height = '100%';
    editorContainer.appendChild(root);
    return root;
  }

  /**
   * Creates one fixed-height row of the root column.
   *
   * @param className CSS class of the row.
   * @returns Row element.
   */
  private rowCreate(className: string): HTMLElement {
    const row = document.createElement('div');
    row.classList.add(className);
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.flex = '0 0 auto';
    this.root.appendChild(row);
    return row;
  }

  /**
   * Creates the splitter between the map area and the inspector.
   *
   * @param state Saved shell state.
   * @returns Inspector splitter.
   */
  private inspectorSplitterCreate(state: ShellState): SplitterBox {
    const splitter = new SplitterBox({
      orientation: 'horizontal',
      sizedPane: 'second',
      initialSizePx: state.inspectorWidthPx,
      minSizedPx: SHELL_INSPECTOR_MIN_WIDTH_PX,
      minFlexiblePx: SHELL_FRAME_VIEWS_MIN_WIDTH_PX,
    });
    splitter.getElement().classList.add('shell-frame-body');
    splitter.changeListenerAdd((sizePx) => this.stateStore.update({ inspectorWidthPx: sizePx }));
    return splitter;
  }

  /**
   * Creates the splitter between the map views and the info panel.
   *
   * @param state Saved shell state.
   * @returns Info panel splitter.
   */
  private infoPanelSplitterCreate(state: ShellState): SplitterBox {
    const splitter = new SplitterBox({
      orientation: 'vertical',
      sizedPane: 'second',
      initialSizePx: state.infoPanelHeightPx,
      minSizedPx: SHELL_INFO_PANEL_MIN_HEIGHT_PX,
      minFlexiblePx: SHELL_FRAME_VIEWS_MIN_HEIGHT_PX,
    });
    splitter.changeListenerAdd((sizePx) => this.stateStore.update({ infoPanelHeightPx: sizePx }));
    return splitter;
  }

  /**
   * Creates the view bar row above the map views.
   *
   * @returns View bar element.
   */
  private viewBarCreate(): HTMLElement {
    const bar = document.createElement('div');
    bar.classList.add('shell-view-bar');
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.flex = '0 0 auto';
    bar.style.minHeight = '30px';
    bar.style.gap = '6px';
    bar.style.padding = '0 4px';
    bar.style.background = hexToRgb(Theme.toolbarBackground);
    bar.style.borderBottom = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    return bar;
  }

  /**
   * Creates one part of the view bar.
   *
   * @param className CSS class of the part.
   * @param flex CSS flex value of the part.
   * @returns Slot element appended to the view bar.
   */
  private viewBarSlotCreate(className: string, flex: string): HTMLElement {
    const slot = document.createElement('div');
    slot.classList.add(className);
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.flex = flex;
    slot.style.minWidth = '0';
    this.viewBar.appendChild(slot);
    return slot;
  }

  /**
   * Creates the column that stacks the view bar over the map views.
   *
   * @returns View column.
   */
  private viewColumnCreate(): HTMLElement {
    const column = document.createElement('div');
    column.classList.add('shell-view-column');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.flex = '1 1 auto';
    column.style.minWidth = '0';
    column.style.minHeight = '0';
    column.appendChild(this.viewBar);
    return column;
  }

  /**
   * Nests the splitters: views over info panel on the left, inspector on the
   * right.
   */
  private splittersMount(): void {
    this.infoPanelSplitter.getFirstPane().appendChild(this.viewColumn);
    this.inspectorSplitter.getFirstPane().appendChild(this.infoPanelSplitter.getElement());
    this.root.appendChild(this.inspectorSplitter.getElement());
  }

  /**
   * Applies the saved visibility of the docks and the toolbar.
   *
   * @param state Saved shell state.
   */
  private visibilityRestore(state: ShellState): void {
    this.inspectorSplitter.setSizedPaneCollapsed(!state.inspectorVisible);
    this.infoPanelSplitter.setSizedPaneCollapsed(!state.infoPanelVisible);
    this.toolbarHost.style.display = state.toolbarVisible ? 'flex' : 'none';
  }

  /** Tells every visibility listener that a dock or the toolbar changed. */
  private visibilityListenersNotify(): void {
    this.visibilityListeners.forEach((listener) => listener());
  }
}
