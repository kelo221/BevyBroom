import type { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import {
  PanelFloatingLayoutRegistry,
  type PanelFloatingLayoutProvider,
} from '@/ui/floating_panel/layout/panel_floating_layout_registry.js';
import {
  panelFloatingLayoutRectOf,
  type PanelFloatingLayoutRect,
} from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';
import { DOCK_SIDES, type DockSide } from '@/ui/dock/dock_side.js';
import { DockZone } from '@/ui/dock/zone/dock_zone.js';
import { DockDropPreview } from '@/ui/dock/drop/dock_drop_preview.js';
import { dockDropTargetResolve, type DockDropTarget } from '@/ui/dock/drop/dock_drop_target.js';
import type { DockLayoutStorage, DockWindowLayout } from '@/ui/dock/state/dock_window_layout.js';
import { DockManagerWindowBinding } from './dock_manager_window_binding.js';
import { DockWindowMenu } from './dock_window_menu.js';
import { dockFloatingTileRectsCompute } from './dock_floating_tile_layout.js';

/** Main window parts the docks live in. */
export interface DockManagerFrame {
  /**
   * Returns the pane that holds the dock of an edge.
   *
   * @param side Dock edge.
   * @returns Pane element.
   */
  dockPaneRead(side: DockSide): HTMLElement;
  /**
   * Shows or hides the pane of an edge's dock.
   *
   * @param side Dock edge.
   * @param isVisible True to show it.
   */
  dockPaneVisibleSet(side: DockSide, isVisible: boolean): void;
  /**
   * Returns the area the docks share, used to find drop targets and to tile
   * floating windows.
   *
   * @returns Dock area element.
   */
  dockAreaRead(): HTMLElement;
}

/** Where a tool window is, as reported to tools and menus. */
export interface DockManagerWindowState {
  /** Window title. */
  readonly title: string;
  /** Edge it is docked to, or floating. */
  readonly placement: DockSide | 'floating';
  /** True while shown. */
  readonly isOpen: boolean;
  /** Client rect while shown, or null. */
  readonly rect: PanelFloatingLayoutRect | null;
}

/**
 * Lays out every tool window with a layout id: docks windows to the left, right
 * or bottom edge of the main window as tabs, floats them again, shows where a
 * dragged window docks, remembers each window's placement, and tiles the
 * floating windows.
 */
export class DockManager implements PanelFloatingLayoutProvider {
  private readonly frame: DockManagerFrame;
  private readonly storage: DockLayoutStorage;
  private readonly zones = new Map<DockSide, DockZone>();
  private readonly panels = new Map<string, PanelFloating>();
  private readonly bindings = new Map<string, DockManagerWindowBinding>();
  private readonly dropPreview: DockDropPreview;
  private readonly windowMenu: DockWindowMenu;

  /**
   * Creates the docks in the main window and joins every tool window.
   *
   * @param frame Main window parts the docks live in.
   * @param storage Store of the saved placements.
   */
  constructor(frame: DockManagerFrame, storage: DockLayoutStorage) {
    this.frame = frame;
    this.storage = storage;
    const ownerDocument = frame.dockAreaRead().ownerDocument;
    this.dropPreview = new DockDropPreview(ownerDocument);
    this.windowMenu = new DockWindowMenu({
      windowDock: (windowId, side) => this.windowDock(windowId, side),
      windowClose: (windowId) => this.panels.get(windowId)?.hide(true),
    });
    DOCK_SIDES.forEach((side) => this.zoneCreate(ownerDocument, side));
    PanelFloatingLayoutRegistry.providerSet(this);
  }

  /**
   * Returns the dock binding of a window, creating it on first use.
   *
   * @param panel Window with a layout id.
   * @returns Binding.
   */
  bindingFor(panel: PanelFloating): DockManagerWindowBinding {
    const windowId = panel.layoutIdRead() ?? '';
    this.panels.set(windowId, panel);
    const existing = this.bindings.get(windowId);
    if (existing) {
      return existing;
    }
    const binding = new DockManagerWindowBinding(windowId, this.bindingHostCreate());
    this.bindings.set(windowId, binding);
    return binding;
  }

  /**
   * Learns about a window with a layout id.
   *
   * @param panel Window.
   */
  panelAdded(panel: PanelFloating): void {
    const windowId = panel.layoutIdRead();
    if (windowId !== null) {
      this.panels.set(windowId, panel);
    }
  }

  /**
   * Forgets a disposed window.
   *
   * @param panel Window.
   */
  panelRemoved(panel: PanelFloating): void {
    const windowId = panel.layoutIdRead();
    if (windowId !== null && this.panels.get(windowId) === panel) {
      this.panels.delete(windowId);
    }
  }

  /**
   * Docks a window to an edge, or floats it with null, moving it at once when
   * it is open.
   *
   * @param windowId Window layout id.
   * @param side Dock edge, or null to float.
   */
  windowDock(windowId: string, side: DockSide | null): void {
    this.windowLayoutUpdate(windowId, { side });
    const panel = this.panels.get(windowId);
    if (panel?.isOpen() === true) {
      panel.hide(true);
      panel.show();
    }
  }

  /**
   * Floats a docked window, continuing a drag when one pulled it out.
   *
   * @param windowId Window layout id.
   * @param dragEvent Pointer event of the drag, or null.
   */
  windowFloat(windowId: string, dragEvent: PointerEvent | null): void {
    this.windowDock(windowId, null);
    if (dragEvent !== null) {
      this.panels.get(windowId)?.titleDragContinueAt(dragEvent);
    }
  }

  /**
   * Moves and sizes a window's floating rect, at once when it floats open.
   *
   * @param windowId Window layout id.
   * @param rect Floating rect in client pixels.
   */
  windowFloatingRectSet(windowId: string, rect: PanelFloatingLayoutRect): void {
    this.windowLayoutUpdate(windowId, { floatingRect: rect });
    const panel = this.panels.get(windowId);
    if (panel?.isOpen() === true && !panel.isDocked()) {
      panel.hide(true);
      panel.show();
    }
  }

  /** Opens every window that reopens at startup and was open at quit. */
  windowsOpenRestore(): void {
    this.panels.forEach((panel, windowId) => {
      if (panel.layoutRestoresOpenRead() && this.storage.windowLayoutRead(windowId).isOpen) {
        panel.show();
      }
    });
  }

  /** Arranges every open floating window side by side over the dock area. */
  floatingWindowsTile(): void {
    const floating = [...this.panels.entries()].filter(([, panel]) => panel.isOpen() && !panel.isDocked());
    const area = panelFloatingLayoutRectOf(this.frame.dockAreaRead());
    const rects = dockFloatingTileRectsCompute(area, floating.length);
    floating.forEach(([windowId, panel], index) => {
      this.windowLayoutUpdate(windowId, { floatingRect: rects[index] ?? null });
      panel.hide(true);
      panel.show();
    });
  }

  /** Floats every window at its default place and size. */
  layoutReset(): void {
    const openPanels = [...this.panels.values()].filter((panel) => panel.isOpen());
    openPanels.forEach((panel) => panel.hide(true));
    this.storage.windowLayoutsClear();
    openPanels.forEach((panel) => panel.show());
  }

  /**
   * Reports where every known window is.
   *
   * @returns Window states by layout id.
   */
  windowStatesRead(): Record<string, DockManagerWindowState> {
    const states: Record<string, DockManagerWindowState> = {};
    this.panels.forEach((panel, windowId) => {
      const isOpen = panel.isOpen();
      states[windowId] = {
        title: panel.layoutTitleRead(),
        placement: this.storage.windowLayoutRead(windowId).side ?? 'floating',
        isOpen,
        rect: isOpen ? panelFloatingLayoutRectOf(panel.getRootElement()) : null,
      };
    });
    return states;
  }

  /**
   * Returns the window shown in front in the dock of an edge.
   *
   * @param side Dock edge.
   * @returns Window layout id, or null for an empty dock.
   */
  zoneActiveWindowRead(side: DockSide): string | null {
    return this.zones.get(side)?.activeWindowIdRead() ?? null;
  }

  /** Removes the docks and leaves the windows to float without a dock system. */
  dispose(): void {
    if (PanelFloatingLayoutRegistry.providerRead() === this) {
      PanelFloatingLayoutRegistry.providerSet(null);
    }
    this.dropPreview.hide();
    this.windowMenu.dispose();
    this.zones.forEach((zone) => zone.dispose());
    this.zones.clear();
  }

  /**
   * Creates the dock of one edge inside its hidden pane.
   *
   * @param ownerDocument Document that creates the dock.
   * @param side Dock edge.
   */
  private zoneCreate(ownerDocument: Document, side: DockSide): void {
    const zone = new DockZone(ownerDocument, side, {
      windowFloat: (windowId, dragEvent) => this.windowFloat(windowId, dragEvent),
      windowClose: (windowId) => this.panels.get(windowId)?.hide(true),
      windowMenuOpen: (windowId, clientX, clientY) => this.windowMenuOpen(windowId, clientX, clientY),
    });
    this.frame.dockPaneRead(side).appendChild(zone.getElement());
    this.frame.dockPaneVisibleSet(side, false);
    this.zones.set(side, zone);
  }

  /**
   * Returns the callbacks a window binding uses.
   *
   * @returns Binding host.
   */
  private bindingHostCreate(): ConstructorParameters<typeof DockManagerWindowBinding>[1] {
    return {
      windowLayoutRead: (windowId) => this.storage.windowLayoutRead(windowId),
      windowLayoutUpdate: (windowId, changes) => this.windowLayoutUpdate(windowId, changes),
      zoneMount: (windowId) => this.zoneMount(windowId),
      zoneUnmount: (windowId) => this.zoneUnmount(windowId),
      dropPreviewUpdate: (event) => this.dropPreviewUpdate(event),
      dropTargetTake: (event) => this.dropTargetTake(event),
      windowDock: (windowId, side) => this.windowDock(windowId, side),
      windowMenuOpen: (windowId, clientX, clientY) => this.windowMenuOpen(windowId, clientX, clientY),
    };
  }

  /**
   * Changes parts of a window's saved placement.
   *
   * @param windowId Window layout id.
   * @param changes Parts to replace.
   */
  private windowLayoutUpdate(windowId: string, changes: Partial<DockWindowLayout>): void {
    this.storage.windowLayoutWrite(windowId, { ...this.storage.windowLayoutRead(windowId), ...changes });
  }

  /**
   * Puts a window's root into the dock of its saved edge and shows the dock.
   *
   * @param windowId Window layout id.
   */
  private zoneMount(windowId: string): void {
    const side = this.storage.windowLayoutRead(windowId).side;
    const panel = this.panels.get(windowId);
    const zone = side === null ? undefined : this.zones.get(side);
    if (side === null || panel === undefined || zone === undefined) {
      return;
    }
    zone.windowAdd(windowId, panel.layoutTitleRead(), panel.getRootElement());
    this.frame.dockPaneVisibleSet(side, true);
  }

  /**
   * Takes a window out of the dock it shows in, hiding the dock once empty.
   *
   * @param windowId Window layout id.
   */
  private zoneUnmount(windowId: string): void {
    const side = this.bindings.get(windowId)?.mountedSideRead() ?? null;
    const zone = side === null ? undefined : this.zones.get(side);
    if (side === null || zone === undefined) {
      return;
    }
    zone.windowRemove(windowId);
    this.panels.get(windowId)?.getRootElement().remove();
    if (zone.isEmpty()) {
      this.frame.dockPaneVisibleSet(side, false);
    }
  }

  /**
   * Shows where a title bar drag would dock, or hides the preview.
   *
   * @param event Pointer move of the drag.
   */
  private dropPreviewUpdate(event: PointerEvent): void {
    const target = this.dropTargetAt(event);
    if (target === null) {
      this.dropPreview.hide();
      return;
    }
    this.dropPreview.show(target.previewRect);
  }

  /**
   * Returns the dock edge under a title bar release and hides the preview.
   *
   * @param event Pointer release.
   * @returns Dock edge, or null.
   */
  private dropTargetTake(event: PointerEvent): DockSide | null {
    this.dropPreview.hide();
    return this.dropTargetAt(event)?.side ?? null;
  }

  /**
   * Resolves the dock target under a pointer; holding Ctrl or Cmd keeps the
   * window floating.
   *
   * @param event Pointer event.
   * @returns Dock target, or null.
   */
  private dropTargetAt(event: PointerEvent): DockDropTarget | null {
    if (event.ctrlKey || event.metaKey) {
      return null;
    }
    const shownZoneRects: Partial<Record<DockSide, PanelFloatingLayoutRect>> = {};
    this.zones.forEach((zone, side) => {
      if (!zone.isEmpty()) {
        shownZoneRects[side] = panelFloatingLayoutRectOf(zone.getElement());
      }
    });
    const areaRect = panelFloatingLayoutRectOf(this.frame.dockAreaRead());
    return dockDropTargetResolve({ clientX: event.clientX, clientY: event.clientY, areaRect, shownZoneRects });
  }

  /**
   * Opens the layout menu of a window.
   *
   * @param windowId Window layout id.
   * @param clientX Menu client X.
   * @param clientY Menu client Y.
   */
  private windowMenuOpen(windowId: string, clientX: number, clientY: number): void {
    this.windowMenu.open(windowId, this.storage.windowLayoutRead(windowId).side, clientX, clientY);
  }
}
