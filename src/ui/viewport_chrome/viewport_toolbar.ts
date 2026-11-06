import { ShadingMode } from '@/types/shading_mode.js';
import { IconHammerCatalog } from '@/ui/icons/hammer/icon_hammer_catalog.js';
import { PanelMenu } from '@/ui/menu/panel_menu.js';
import { MenuOutsidePointerClose } from '@/ui/menu/menu_outside_pointer_close.js';
import { ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';
import { buildViewportViewMenuEntries, type ViewportViewMenuState } from './viewport_type_menu.js';
import { viewportAxisCaptionForKind, viewportAxisCaptionForTitle } from './viewport_axis_caption.js';
import { ViewportLabel } from './viewport_label.js';
import { ViewportHoverButtonRow } from './viewport_hover_button_row.js';
import { VIEWPORT_SHADING_CHOICES } from './viewport_shading_choices.js';

/** CSS class of the top-left cluster holding the corner label. */
export const VIEWPORT_CORNER_CLUSTER_CLASS = 'editor-viewport-corner';

/** Handlers registered on a viewport chrome; each is optional until wired. */
interface ViewportToolbarCallbacks {
  shadingMode?: (mode: ShadingMode) => void;
  contentWireframesToggle?: (visible: boolean) => void;
  projectedGridToggle?: (visible: boolean) => void;
  fit?: () => void;
  maximizeToggle?: () => void;
  kindChange?: (kind: ViewportKind) => void;
}

/**
 * Hammer-style chrome of one viewport: a corner label at the top-left that
 * opens the view menu (view kind, shading, render toggles, fit, maximize), and
 * a hover-only icon row at the top-right with the shading modes and maximize.
 * The view starts at the top of the pane.
 */
export class ViewportToolbar {
  private readonly ownerDocument: Document;
  private readonly ownerWindow: Window;
  private readonly cornerCluster: HTMLElement;
  private readonly label: ViewportLabel;
  private readonly hoverRow: ViewportHoverButtonRow;
  private readonly outsideCloser = new MenuOutsidePointerClose();
  private readonly shadingButtons = new Map<ShadingMode, HTMLButtonElement>();
  private readonly callbacks: ViewportToolbarCallbacks = {};
  private readonly maximizeButton: HTMLButtonElement;
  private viewMenuPanel: PanelMenu | null = null;
  private titleText: string;
  private currentMode: ShadingMode;
  private currentKind: ViewportKind = ViewportKind.PERSPECTIVE;
  private contentWireframesActive = true;
  private projectedGridActive = true;
  private maximized = false;

  /**
   * Creates the viewport chrome inside the pane element.
   *
   * @param parentElement The viewport pane element.
   * @param titleText The viewport display name.
   * @param initialMode The shading mode to highlight initially.
   */
  constructor(parentElement: HTMLElement, titleText: string, initialMode: ShadingMode = ShadingMode.SOLID) {
    this.ownerDocument = parentElement.ownerDocument;
    this.ownerWindow = parentElement.ownerDocument.defaultView ?? window;
    this.titleText = titleText;
    this.currentMode = initialMode;
    this.cornerCluster = this.cornerClusterCreate(parentElement);
    this.label = new ViewportLabel(this.cornerCluster, '', () => this.viewMenuToggle());
    this.labelTextRefresh(viewportAxisCaptionForTitle(titleText));
    this.hoverRow = new ViewportHoverButtonRow(parentElement);
    this.shadingButtonsCreate();
    this.maximizeButton = this.hoverRow.buttonAdd(
      'Maximize viewport',
      IconHammerCatalog.toolbarSvg('view_maximize'),
      () => this.maximizeToggle(),
    );
    this.setActiveShadingMode(initialMode);
  }

  /**
   * Registers the callback invoked when a shading mode is chosen.
   *
   * @param callback The shading mode change handler.
   */
  setOnShadingMode(callback: (mode: ShadingMode) => void): void {
    this.callbacks.shadingMode = callback;
  }

  /**
   * Registers the callback invoked when content wireframes are toggled.
   *
   * @param callback Toggle handler receiving the new visibility.
   */
  setOnContentWireframesToggle(callback: (visible: boolean) => void): void {
    this.callbacks.contentWireframesToggle = callback;
  }

  /**
   * Registers the callback invoked when the projected grid is toggled.
   *
   * @param callback Toggle handler receiving the new visibility.
   */
  setOnProjectedGridToggle(callback: (visible: boolean) => void): void {
    this.callbacks.projectedGridToggle = callback;
  }

  /**
   * Registers the callback invoked by Fit to Selection.
   *
   * @param callback The fit action handler.
   */
  setOnFit(callback: () => void): void {
    this.callbacks.fit = callback;
  }

  /**
   * Registers the callback invoked by maximize/restore.
   *
   * @param callback Viewport layout toggle handler.
   */
  setOnToggleMaximize(callback: () => void): void {
    this.callbacks.maximizeToggle = callback;
  }

  /**
   * Registers the callback invoked when the user picks a viewport type.
   *
   * @param callback Kind change handler.
   */
  setOnViewportKindChange(callback: (kind: ViewportKind) => void): void {
    this.callbacks.kindChange = callback;
  }

  /**
   * Shows the axis caption of a viewport kind in the corner label and checks
   * that kind in the view menu.
   *
   * @param kind Active viewport kind.
   */
  setViewportKind(kind: ViewportKind): void {
    this.currentKind = kind;
    this.titleText = getViewportKindDisplayLabel(kind);
    this.labelTextRefresh(viewportAxisCaptionForKind(kind));
  }

  /**
   * Updates the maximize button tooltip and selected appearance.
   *
   * @param maximized Whether this viewport currently fills the workspace.
   */
  setMaximized(maximized: boolean): void {
    this.maximized = maximized;
    const label = maximized ? 'Restore viewport layout' : 'Maximize viewport';
    this.maximizeButton.title = label;
    this.maximizeButton.setAttribute('aria-label', label);
    this.hoverRow.buttonActiveSet(this.maximizeButton, maximized);
  }

  /**
   * Returns whether the viewport is shown as maximized.
   *
   * @returns True while maximized.
   */
  isMaximized(): boolean {
    return this.maximized;
  }

  /**
   * Updates which shading mode appears selected.
   *
   * @param mode The mode to mark as active.
   */
  setActiveShadingMode(mode: ShadingMode): void {
    this.currentMode = mode;
    this.shadingButtons.forEach((button, buttonMode) => {
      this.hoverRow.buttonActiveSet(button, buttonMode === mode);
    });
  }

  /**
   * Returns the currently highlighted shading mode.
   *
   * @returns The active ShadingMode value.
   */
  getActiveShadingMode(): ShadingMode {
    return this.currentMode;
  }

  /**
   * Updates the view name; the corner label shows its axis caption when the
   * name is a view kind, else the name itself.
   *
   * @param titleText New display title.
   */
  setTitle(titleText: string): void {
    this.titleText = titleText;
    this.labelTextRefresh(viewportAxisCaptionForTitle(titleText));
  }

  /**
   * Returns the corner label that opens the view menu.
   *
   * @returns Corner label button.
   */
  getTitleElement(): HTMLElement {
    return this.label.getLabelElement();
  }

  /**
   * Returns the view menu panel while it exists.
   *
   * @returns Menu panel, or null before the menu was first opened.
   */
  getViewMenuPanel(): PanelMenu | null {
    return this.viewMenuPanel;
  }

  /**
   * Returns the top-left cluster that holds the corner label.
   *
   * @returns Corner cluster element.
   */
  getElement(): HTMLElement {
    return this.cornerCluster;
  }

  /**
   * Returns the hover-only icon row at the top-right.
   *
   * @returns Hover row.
   */
  getHoverRow(): ViewportHoverButtonRow {
    return this.hoverRow;
  }

  /**
   * Inserts a control right after the corner label.
   *
   * @param element Control element to insert after the label.
   */
  insertControlAfterTitle(element: HTMLElement): void {
    this.label.getLabelElement().after(element);
  }

  /**
   * Returns the maximize button of the hover row.
   *
   * @returns The maximize button.
   */
  getMaximizeButton(): HTMLButtonElement {
    return this.maximizeButton;
  }

  /**
   * Returns the hover row button of a shading mode.
   *
   * @param mode The shading mode whose button is requested.
   * @returns The button element, or undefined if missing.
   */
  getShadingButton(mode: ShadingMode): HTMLButtonElement | undefined {
    return this.shadingButtons.get(mode);
  }

  /**
   * Records whether content wireframes are shown.
   *
   * @param active Whether wireframes are enabled.
   */
  setContentWireframesActive(active: boolean): void {
    this.contentWireframesActive = active;
  }

  /**
   * Returns whether content wireframes are shown.
   *
   * @returns True when enabled.
   */
  isContentWireframesActive(): boolean {
    return this.contentWireframesActive;
  }

  /**
   * Records whether the projected grid is shown.
   *
   * @param active Whether the projected grid is enabled.
   */
  setProjectedGridActive(active: boolean): void {
    this.projectedGridActive = active;
  }

  /**
   * Returns whether the projected grid is shown.
   *
   * @returns True when enabled.
   */
  isProjectedGridActive(): boolean {
    return this.projectedGridActive;
  }

  /** Closes the view menu and removes the chrome from the DOM. */
  dispose(): void {
    this.viewMenuClose();
    this.viewMenuPanel?.dispose();
    this.viewMenuPanel = null;
    this.hoverRow.dispose();
    this.cornerCluster.remove();
    this.shadingButtons.clear();
  }

  /**
   * Creates the top-left cluster that holds the corner label and inserted
   * controls.
   *
   * @param parentElement Viewport pane element.
   * @returns Cluster element appended to the pane.
   */
  private cornerClusterCreate(parentElement: HTMLElement): HTMLElement {
    const cluster = this.ownerDocument.createElement('div');
    cluster.classList.add(VIEWPORT_CORNER_CLUSTER_CLASS);
    cluster.style.position = 'absolute';
    cluster.style.top = '0';
    cluster.style.left = '0';
    cluster.style.display = 'flex';
    cluster.style.alignItems = 'center';
    cluster.style.gap = '2px';
    cluster.style.zIndex = String(UiStackLayers.viewportChrome);
    parentElement.appendChild(cluster);
    return cluster;
  }

  /**
   * Shows a caption in the corner label, or the view name when there is none.
   *
   * @param caption Axis caption, or an empty string.
   */
  private labelTextRefresh(caption: string): void {
    this.label.textSet(caption === '' ? this.titleText : caption, this.titleText);
  }

  /** Adds one hover row button per shading mode. */
  private shadingButtonsCreate(): void {
    VIEWPORT_SHADING_CHOICES.forEach((choice) => {
      const button = this.hoverRow.buttonAdd(choice.label, choice.iconSvgRead(), () => this.shadingSelect(choice.mode));
      this.shadingButtons.set(choice.mode, button);
    });
  }

  /**
   * Applies a chosen shading mode and notifies the registered handler.
   *
   * @param mode Chosen shading mode.
   */
  private shadingSelect(mode: ShadingMode): void {
    this.setActiveShadingMode(mode);
    this.callbacks.shadingMode?.(mode);
  }

  /** Toggles content wireframes and notifies the registered handler. */
  private contentWireframesToggle(): void {
    const next = !this.contentWireframesActive;
    this.setContentWireframesActive(next);
    this.callbacks.contentWireframesToggle?.(next);
  }

  /** Toggles the projected grid and notifies the registered handler. */
  private projectedGridToggle(): void {
    const next = !this.projectedGridActive;
    this.setProjectedGridActive(next);
    this.callbacks.projectedGridToggle?.(next);
  }

  /** Runs the registered maximize/restore handler. */
  private maximizeToggle(): void {
    this.callbacks.maximizeToggle?.();
  }

  /**
   * Switches to a chosen view kind through the registered handler.
   *
   * @param kind Chosen view kind.
   */
  private kindSelect(kind: ViewportKind): void {
    this.callbacks.kindChange?.(kind);
  }

  /**
   * Returns the live state shown by the view menu checks.
   *
   * @returns View menu state.
   */
  private viewMenuStateRead(): ViewportViewMenuState {
    return {
      kind: this.currentKind,
      shadingMode: this.currentMode,
      contentWireframesActive: this.contentWireframesActive,
      projectedGridActive: this.projectedGridActive,
      maximized: this.maximized,
    };
  }

  /** Rebuilds the view menu panel bound to the shared action handlers. */
  private viewMenuRebuild(): void {
    this.viewMenuPanel?.dispose();
    const entries = buildViewportViewMenuEntries(() => this.viewMenuStateRead(), {
      onKindSelect: (kind) => this.kindSelect(kind),
      onShadingSelect: (mode) => this.shadingSelect(mode),
      onContentWireframesToggle: () => this.contentWireframesToggle(),
      onProjectedGridToggle: () => this.projectedGridToggle(),
      onFit: () => this.callbacks.fit?.(),
      onMaximizeToggle: () => this.maximizeToggle(),
    });
    this.viewMenuPanel = new PanelMenu(entries, () => this.viewMenuClose(), false, this.ownerDocument);
    this.cornerCluster.appendChild(this.viewMenuPanel.getElement());
  }

  /** Opens or closes the view menu. */
  private viewMenuToggle(): void {
    if (this.viewMenuPanel?.isOpen()) {
      this.viewMenuClose();
      return;
    }
    this.viewMenuOpen();
  }

  /** Shows the view menu under the corner label and listens for outside presses. */
  private viewMenuOpen(): void {
    this.viewMenuRebuild();
    const panel = this.viewMenuPanel;
    if (!panel) {
      return;
    }
    panel.open(this.label.getLabelElement());
    this.label.expandedSet(true);
    this.outsideCloser.begin(
      this.ownerWindow,
      (target) => MenuOutsidePointerClose.isTargetInsideSurfaces([this.cornerCluster, panel.getElement()], target),
      () => this.viewMenuClose(),
    );
  }

  /** Hides the view menu and removes the outside-press listener. */
  private viewMenuClose(): void {
    this.viewMenuPanel?.close();
    this.label.expandedSet(false);
    this.outsideCloser.end();
  }
}
