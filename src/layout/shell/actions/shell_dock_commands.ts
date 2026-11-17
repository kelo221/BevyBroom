import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import type { ShellInfoPanel, ShellInfoPanelTabId } from '@/layout/shell/info_panel/shell_info_panel.js';
import { ShellInfoPanelCollapseBinding } from '@/layout/shell/info_panel/shell_info_panel_collapse_binding.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { DockManager, type DockManagerWindowState } from '@/ui/dock/manager/dock_manager.js';
import type { DockSide } from '@/ui/dock/dock_side.js';
import type { PanelFloatingLayoutRect } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';
import type {
  ShellFloatingWindow,
  ShellFloatingWindowId,
  ShellFloatingWindowOpenChangeListener,
} from './shell_floating_window.js';

/**
 * Commands that show, hide and switch the main window docks and floating
 * windows, and dock, float and tile the tool windows.
 */
export class ShellDockCommands {
  private readonly frame: ShellFrame;
  private readonly infoPanel: ShellInfoPanel;
  private readonly floatingWindows: Map<ShellFloatingWindowId, ShellFloatingWindow>;
  private readonly infoPanelCollapseBinding: ShellInfoPanelCollapseBinding;
  private readonly floatingWindowOpenChangeListeners = new Set<ShellFloatingWindowOpenChangeListener>();
  private readonly floatingWindowUnsubscribers: (() => void)[] = [];
  private readonly dockManager: DockManager;

  /**
   * Creates dock commands over the main window docks and lets clicks on the
   * info panel strip fold and unfold the panel.
   *
   * @param frame Main window skeleton that shows and hides the docks.
   * @param infoPanel Bottom info panel.
   * @param stateStore Store of the saved tool window placements.
   */
  constructor(frame: ShellFrame, infoPanel: ShellInfoPanel, stateStore: ShellStateStore) {
    this.frame = frame;
    this.infoPanel = infoPanel;
    this.floatingWindows = new Map();
    this.infoPanelCollapseBinding = new ShellInfoPanelCollapseBinding(frame, infoPanel);
    this.dockManager = new DockManager(frame.dockSplittersRead(), stateStore);
  }

  /**
   * Stops folding the info panel from strip clicks and forgets the floating
   * windows and their listeners.
   */
  dispose(): void {
    this.dockManager.dispose();
    this.infoPanelCollapseBinding.dispose();
    this.floatingWindowUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.floatingWindowOpenChangeListeners.clear();
    this.floatingWindows.clear();
  }

  /**
   * Registers the floating window opened and closed under one id.
   *
   * @param windowId Floating window id.
   * @param floatingWindow Window to open and close.
   */
  floatingWindowRegister(windowId: ShellFloatingWindowId, floatingWindow: ShellFloatingWindow): void {
    this.floatingWindows.set(windowId, floatingWindow);
    const unsubscribe = floatingWindow.openChangeListenerAdd?.((isOpen) =>
      this.floatingWindowOpenChangeListeners.forEach((listener) => listener(windowId, isOpen)),
    );
    if (unsubscribe) {
      this.floatingWindowUnsubscribers.push(unsubscribe);
    }
  }

  /**
   * Registers a callback run whenever a registered floating window opens or
   * closes.
   *
   * @param listener Receives the window id and whether it is open now.
   * @returns Function that removes the callback.
   */
  floatingWindowOpenChangeListenerAdd(listener: ShellFloatingWindowOpenChangeListener): () => void {
    this.floatingWindowOpenChangeListeners.add(listener);
    return () => this.floatingWindowOpenChangeListeners.delete(listener);
  }

  /**
   * Shows a registered floating window when hidden and hides it when shown.
   *
   * @param windowId Floating window id.
   */
  floatingWindowToggle(windowId: ShellFloatingWindowId): void {
    this.floatingWindows.get(windowId)?.toggle();
  }

  /**
   * Returns whether a registered floating window is shown.
   *
   * @param windowId Floating window id.
   * @returns True while shown; false for an unregistered id.
   */
  isFloatingWindowOpen(windowId: ShellFloatingWindowId): boolean {
    return this.floatingWindows.get(windowId)?.isOpen() ?? false;
  }

  /**
   * Shows or hides a registered floating window.
   *
   * @param windowId Floating window id.
   * @param visible True to show, false to hide.
   */
  floatingWindowVisibleSet(windowId: ShellFloatingWindowId, visible: boolean): void {
    if (this.isFloatingWindowOpen(windowId) !== visible) {
      this.floatingWindowToggle(windowId);
    }
  }

  /**
   * Docks a tool window to an edge of the main window, or floats it with null.
   *
   * @param windowId Layout id of the window.
   * @param side Dock edge, or null to float.
   */
  toolWindowDock(windowId: string, side: DockSide | null): void {
    this.dockManager.windowDock(windowId, side);
  }

  /**
   * Reports where each tool window is docked or floating and whether it is
   * open.
   *
   * @returns Window states by layout id.
   */
  toolWindowStatesRead(): Record<string, DockManagerWindowState> {
    return this.dockManager.windowStatesRead();
  }

  /**
   * Moves and sizes a tool window's floating rect.
   *
   * @param windowId Layout id of the window.
   * @param rect Floating rect in client pixels.
   */
  toolWindowFloatingRectSet(windowId: string, rect: PanelFloatingLayoutRect): void {
    this.dockManager.windowFloatingRectSet(windowId, rect);
  }

  /** Arranges every open floating tool window side by side over the map area. */
  floatingWindowsTile(): void {
    this.dockManager.floatingWindowsTile();
  }

  /** Floats every tool window at its default place and size. */
  toolWindowLayoutReset(): void {
    this.dockManager.layoutReset();
  }

  /** Opens the tool windows that were open at quit and reopen at startup. */
  toolWindowsOpenRestore(): void {
    this.dockManager.windowsOpenRestore();
  }

  /** Shows the inspector when it is hidden. */
  inspectorReveal(): void {
    if (!this.frame.isInspectorVisible()) {
      this.frame.inspectorVisibleSet(true);
    }
  }

  /**
   * Shows and unfolds the info panel with one tab in front.
   *
   * @param tabId Info panel tab to show.
   */
  infoPanelTabReveal(tabId: ShellInfoPanelTabId): void {
    if (!this.frame.isInfoPanelVisible()) {
      this.frame.infoPanelVisibleSet(true);
    }
    if (this.frame.isInfoPanelCollapsed()) {
      this.frame.infoPanelCollapsedSet(false);
    }
    this.infoPanel.tabShow(tabId);
  }

  /** Unfolds the info panel when folded to its strip and folds it when unfolded. */
  infoPanelCollapsedToggle(): void {
    this.frame.infoPanelCollapsedSet(!this.frame.isInfoPanelCollapsed());
  }

  /**
   * Returns whether the info panel is folded to its strip.
   *
   * @returns True while folded.
   */
  isInfoPanelCollapsed(): boolean {
    return this.frame.isInfoPanelCollapsed();
  }

  /** Shows the inspector when hidden and hides it when shown. */
  inspectorToggle(): void {
    this.frame.inspectorVisibleSet(!this.frame.isInspectorVisible());
  }

  /** Shows the info panel when hidden and hides it when shown. */
  infoPanelToggle(): void {
    this.frame.infoPanelVisibleSet(!this.frame.isInfoPanelVisible());
  }

  /** Shows the main toolbar when hidden and hides it when shown. */
  toolbarToggle(): void {
    this.frame.toolbarVisibleSet(!this.frame.isToolbarVisible());
  }

  /** Shows the left vertical tools palette when hidden and hides it when shown. */
  toolsPaletteToggle(): void {
    this.frame.toolsPaletteVisibleSet(!this.frame.isToolsPaletteVisible());
  }

  /**
   * Returns whether the inspector is shown.
   *
   * @returns True while shown.
   */
  isInspectorVisible(): boolean {
    return this.frame.isInspectorVisible();
  }

  /**
   * Returns whether the info panel is shown.
   *
   * @returns True while shown.
   */
  isInfoPanelVisible(): boolean {
    return this.frame.isInfoPanelVisible();
  }

  /**
   * Returns whether the main toolbar is shown.
   *
   * @returns True while shown.
   */
  isToolbarVisible(): boolean {
    return this.frame.isToolbarVisible();
  }

  /**
   * Returns whether the left vertical tools palette is shown.
   *
   * @returns True while shown.
   */
  isToolsPaletteVisible(): boolean {
    return this.frame.isToolsPaletteVisible();
  }
}
