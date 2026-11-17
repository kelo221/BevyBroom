import { Theme } from '@/theme.js';
import { FloatingPanelStack, type FloatingPanelStackLayer } from './panel_floating_stack.js';
import { clampFloatingPanelRectToScreen, FLOATING_PANEL_SCREEN_PADDING_PX } from './panel_floating_screen_bounds.js';
import {
  floatingPanelBesidePlacementCompute,
  floatingPanelBesideRectRead,
  FLOATING_PANEL_BESIDE_GAP_PX,
} from './panel_floating_beside_placement.js';
import {
  freeFirstPlacementRetryCancel,
  freeFirstPlacementRetryRemaining,
  freeFirstPlacementRetrySchedule,
  placementAnchorRectIsDegenerate,
} from './panel_floating_first_placement.js';
import {
  buildFloatingPanelTitleBar,
  type FloatingPanelTitleBarOptions,
  type FloatingPanelTitleBarParts,
} from './panel_floating_title_bar.js';
import { PanelFloatingLayout } from './layout/panel_floating_layout.js';
import { PanelFloatingLayoutRegistry } from './layout/panel_floating_layout_registry.js';
import { PanelFloatingTitleDrag } from './panel_floating_title_drag.js';

/** Startup corner placement relative to the viewport anchor. */
export type FloatingPanelCorner = 'top-left' | 'bottom-left' | 'bottom-right';

/** Construction options for a floating tool window or modal dialog. */
export interface FloatingPanelOptions {
  /**
   * Corner of the anchor used for the first open position; top-left when
   * omitted.
   */
  corner?: FloatingPanelCorner;
  /**
   * When true, top-left placement sits below the viewport corner label. Only
   * applies to top-left corners.
   */
  insetBelowViewportToolbar?: boolean;
  /** Outer padding from the anchor edges in CSS pixels. */
  paddingPx?: number;
  /** When false, title-bar drag is disabled. Defaults to true. */
  draggable?: boolean;
  /** When true, mounts a full-screen dimmed backdrop behind the panel. */
  modal?: boolean;
  /**
   * When true, centers the panel. Modal panels stay flex-centered on their
   * backdrop. Non-modal panels are centered in the placement anchor on their
   * first open and keep their (dragged) position on later opens, clamped to the
   * screen. The corner option is ignored for centered panels.
   */
  centered?: boolean;
  /**
   * Returns the element a non-modal panel opens beside. On its first open the
   * panel sits flush right of that element (left when the right does not fit),
   * top-aligned, or centered in the placement anchor when neither fits or the
   * element is missing or hidden; later opens keep the (dragged) position,
   * clamped to the screen. The corner and centered options are ignored then.
   */
  besideResolver?: () => HTMLElement | null;
  /** When true and modal, backdrop pointer-down outside the panel closes it. */
  closeOnBackdropClick?: boolean;
  /** When true, Escape hides the panel while it is open. */
  closeOnEscape?: boolean;
  /** Stacking band. Defaults to tool, or modal/confirm when modal is set. */
  stackLayer?: FloatingPanelStackLayer;
  /** Optional class name applied to the modal backdrop element. */
  backdropClassName?: string;
  /** Optional backdrop background CSS. Defaults to a dim scrim when modal. */
  backdropBackground?: string;
  /**
   * Stable id of a non-modal window that can be resized by its edges, docked to
   * an edge of the main window and floated again; the id keys its saved dock,
   * position and size. Windows without an id keep a fixed size.
   */
  layoutId?: string;
  /**
   * When true, a window with a layout id that was open at quit opens again at
   * startup, docked or floating as it was.
   */
  layoutRestoresOpen?: boolean;
}

/**
 * Shared base for floating editor windows and modal dialogs. Owns show/hide,
 * optional modal backdrop, startup anchoring, optional title-bar drag, screen
 * clamping, Escape/backdrop dismiss, and stacking via
 * {@link FloatingPanelStack}.
 *
 * Lifecycle is identical for every subclass: the shell is built in memory on
 * construct, mounted into the host only while open, and removed from the DOM
 * when hidden or disposed.
 */
export abstract class PanelFloating {
  protected readonly root: HTMLElement;
  protected readonly host: HTMLElement;
  private readonly backdrop: HTMLElement | null;
  private defaultAnchor: HTMLElement | null;
  private defaultAnchorResolver: (() => HTMLElement | null) | null;
  private isVisible: boolean;
  private readonly corner: FloatingPanelCorner;
  private readonly insetBelowViewportToolbar: boolean;
  private readonly paddingPx: number;
  private readonly draggable: boolean;
  private readonly modal: boolean;
  private readonly centered: boolean;
  private readonly closeOnBackdropClick: boolean;
  private readonly closeOnEscape: boolean;
  private readonly stackLayer: FloatingPanelStackLayer;
  private readonly titleDrag: PanelFloatingTitleDrag;
  private isShellMounted: boolean;
  private hasFreeFirstPlacement: boolean;
  private freeFirstPlacementRetryFrameId: number | null;
  private freeFirstPlacementRetryCount: number;
  private besideResolver: (() => HTMLElement | null) | null;
  private readonly boundDocumentKeyDown: (event: KeyboardEvent) => void;
  private readonly layout: PanelFloatingLayout | null;
  private isDisposing: boolean;

  /**
   * Creates a floating panel shell. The shell stays out of the document until
   * {@link show} mounts it.
   *
   * @param host Parent element (editor root / toolbar container).
   * @param options Corner, modal, and drag options for placement.
   * @param defaultAnchor Optional viewport container for startup placement.
   */
  protected constructor(host: HTMLElement, options: FloatingPanelOptions, defaultAnchor: HTMLElement | null = null) {
    this.host = host;
    this.defaultAnchor = defaultAnchor;
    this.defaultAnchorResolver = null;
    this.corner = options.corner ?? 'top-left';
    this.insetBelowViewportToolbar = options.insetBelowViewportToolbar === true;
    this.paddingPx = options.paddingPx ?? FLOATING_PANEL_SCREEN_PADDING_PX;
    this.draggable = options.draggable !== false;
    this.modal = options.modal === true;
    this.centered = options.centered === true || (this.modal && options.centered !== false);
    this.closeOnBackdropClick = options.closeOnBackdropClick ?? this.modal;
    this.closeOnEscape = options.closeOnEscape ?? this.modal;
    this.stackLayer = options.stackLayer ?? (this.modal ? 'modal' : 'tool');
    this.isVisible = false;
    this.isShellMounted = false;
    this.hasFreeFirstPlacement = false;
    this.freeFirstPlacementRetryFrameId = null;
    this.freeFirstPlacementRetryCount = 0;
    this.besideResolver = options.besideResolver ?? null;
    this.boundDocumentKeyDown = (event) => this.onDocumentKeyDown(event);
    this.isDisposing = false;
    this.root = this.createShellRoot();
    this.backdrop = this.modal ? this.createModalBackdrop(options) : null;
    this.layout = this.layoutCreate(options);
    this.titleDrag = this.titleDragCreate();
    if (this.layout !== null) {
      PanelFloatingLayoutRegistry.panelAdd(this);
    }
    FloatingPanelStack.register(
      this.getStackElement(),
      () => this.clampToScreenIfVisible(),
      this.stackLayer,
      () => this.hide(true),
    );
    this.bindBringToFrontOnPointer();
  }

  /**
   * Sets the element used for the default open position.
   *
   * @param anchor Viewport container, or null for host.
   */
  setDefaultAnchor(anchor: HTMLElement | null): void {
    this.defaultAnchor = anchor;
  }

  /**
   * Sets a live anchor resolver invoked on every open and reposition.
   *
   * @param resolver Callback returning the placement container, or null.
   */
  setDefaultAnchorResolver(resolver: (() => HTMLElement | null) | null): void {
    this.defaultAnchorResolver = resolver;
  }

  /**
   * Sets the resolver of the element a non-modal panel opens beside on its
   * first open.
   *
   * @param resolver Callback returning that element, or null to use the corner
   *   or centered placement again.
   */
  setBesideResolver(resolver: (() => HTMLElement | null) | null): void {
    this.besideResolver = resolver;
  }

  /**
   * Returns the current default anchor element when set.
   *
   * @returns Anchor element or null.
   */
  getDefaultAnchor(): HTMLElement | null {
    return this.defaultAnchor;
  }

  /**
   * Mounts the shell under the host and shows it. No-ops when already open
   * (still raises the window in the stack).
   */
  show(): void {
    if (this.isVisible) {
      FloatingPanelStack.bringToFront(this.getStackElement(), this.stackLayer);
      return;
    }
    this.isVisible = true;
    if (this.layout?.dockedMount() !== true) {
      this.floatingMount();
    }
    this.applyVisibleDisplayStyles();
    FloatingPanelStack.bringToFront(this.getStackElement(), this.stackLayer);
    this.bindEscapeWhileOpen();
    this.onAfterShow();
    this.layout?.openStateSave(true);
  }

  /**
   * Hides the panel and removes its shell from the document.
   *
   * @param _force Kept for call-site compatibility; always hides.
   */
  hide(_force: boolean = false): void {
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    this.freeFirstPlacementRetryStop();
    this.unbindEscapeWhileOpen();
    this.onAfterHide();
    this.unmountShell();
    if (!this.isDisposing) {
      this.layout?.openStateSave(false);
    }
  }

  /** Toggles visibility. */
  toggle(): void {
    if (this.isVisible) {
      this.hide(true);
      return;
    }
    this.show();
  }

  /**
   * Returns whether the panel is visible and mounted.
   *
   * @returns True when shown.
   */
  isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Returns whether the shell is currently attached under the host.
   *
   * @returns True when the panel root (or modal backdrop) is in the document.
   */
  isMountedInHost(): boolean {
    return this.isShellMounted;
  }

  /**
   * Returns whether a free panel has consumed its first placement.
   *
   * @returns True after a non-degenerate first placement.
   */
  hasConsumedFreeFirstPlacement(): boolean {
    return this.hasFreeFirstPlacement;
  }

  /** Repositions to the default anchor while visible (startup layout pass). */
  repositionToDefaultAnchor(): void {
    if (!this.isVisible) {
      return;
    }
    this.positionDefaultIfNeeded();
    this.clampToScreenIfNeeded();
  }

  /** Clamps the panel into the browser window while it is visible and floating. */
  clampToScreenIfVisible(): void {
    if (!this.isVisible || this.isDocked()) {
      return;
    }
    this.clampToScreenIfNeeded();
  }

  /** Hides if open, unregisters from the stack, and drops any remaining DOM. */
  dispose(): void {
    this.isDisposing = true;
    this.freeFirstPlacementRetryStop();
    this.hide(true);
    FloatingPanelStack.unregister(this.getStackElement());
    this.unmountShellFromHost();
    this.layout?.dispose();
  }

  /**
   * Returns the id that keys the window's saved dock, position and size.
   *
   * @returns Layout id, or null for a window that is not laid out.
   */
  layoutIdRead(): string | null {
    return this.layout?.layoutIdRead() ?? null;
  }

  /**
   * Returns the window title shown on its dock tab.
   *
   * @returns Title text, or an empty string for a window that is not laid out.
   */
  layoutTitleRead(): string {
    return this.layout?.titleRead() ?? '';
  }

  /**
   * Returns whether the window reopens at startup when it was open at quit.
   *
   * @returns True for a laid out window that reopens.
   */
  layoutRestoresOpenRead(): boolean {
    return this.layout?.restoresOpenRead() ?? false;
  }

  /**
   * Returns whether the window lives in a dock instead of floating.
   *
   * @returns True while docked.
   */
  isDocked(): boolean {
    return this.layout?.isDocked() ?? false;
  }

  /**
   * Places the floating window under a pointer with its title bar there and
   * keeps dragging it, as when a docked tab is dragged out of its dock.
   *
   * @param event Pointer event of the ongoing drag.
   */
  titleDragContinueAt(event: PointerEvent): void {
    if (!this.isVisible || this.isDocked()) {
      return;
    }
    const rect = this.root.getBoundingClientRect();
    this.setTopLeftPosition(event.clientX - rect.width / 2, event.clientY - Theme.viewportLabelHeightPx / 2);
    this.titleDrag.begin(event);
  }

  /**
   * Returns the panel root element (card chrome; tests / host wiring).
   *
   * @returns Root HTML element.
   */
  getRootElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the modal backdrop element when this panel is modal.
   *
   * @returns Backdrop element, or null for non-modal panels.
   */
  getBackdropElement(): HTMLElement | null {
    return this.backdrop;
  }

  /**
   * Returns the outermost element that owns pointer hit-testing for this window
   * (modal backdrop when present, otherwise the panel root).
   *
   * @returns Interaction root HTML element.
   */
  getInteractionRootElement(): HTMLElement {
    return this.getStackElement();
  }

  /**
   * Binds title-bar drag that keeps the panel inside the screen when enabled.
   *
   * @param bar Title bar element.
   */
  protected bindTitleBarDrag(bar: HTMLElement): void {
    if (!this.draggable) {
      return;
    }
    bar.addEventListener('pointerdown', (event) => this.titleDrag.titleBarPressHandle(event));
  }

  /**
   * Builds a standard tool-window title bar with close control and drag
   * binding.
   *
   * @param options Title text and layout options (onClose defaults to hide).
   * @returns Title bar parts for further customization.
   */
  protected createStandardTitleBar(
    options: Omit<FloatingPanelTitleBarOptions, 'onClose' | 'ownerDocument'> & {
      onClose?: () => void;
    },
  ): FloatingPanelTitleBarParts {
    const parts = buildFloatingPanelTitleBar({
      ...options,
      ownerDocument: this.root.ownerDocument,
      onClose: options.onClose ?? (() => this.hide(true)),
    });
    this.bindTitleBarDrag(parts.bar);
    this.layout?.titleBarSet(parts.bar, parts.title);
    return parts;
  }

  /**
   * Applies a free top/left position and clears bottom/right anchors.
   *
   * @param left CSS left in pixels.
   * @param top CSS top in pixels.
   */
  protected setTopLeftPosition(left: number, top: number): void {
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.root.style.bottom = 'auto';
    this.root.style.right = 'auto';
  }

  /** Clamps the current panel rect into the browser window. */
  protected clampToScreen(): void {
    const rect = this.root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const clamped = clampFloatingPanelRectToScreen(
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      window.innerWidth,
      window.innerHeight,
      this.paddingPx,
    );
    this.setTopLeftPosition(clamped.left, clamped.top);
  }

  /** Called after the panel becomes visible. */
  protected onAfterShow(): void {}

  /** Called after the panel is hidden. */
  protected onAfterHide(): void {}

  /**
   * Returns the element registered with the window stack.
   *
   * @returns Backdrop for modal panels, otherwise the panel root.
   */
  protected getStackElement(): HTMLElement {
    return this.backdrop ?? this.root;
  }

  /**
   * Creates the resize and dock layout of a non-modal window with a layout id.
   *
   * @param options Floating panel options.
   * @returns Layout, or null for windows without a layout id.
   */
  private layoutCreate(options: FloatingPanelOptions): PanelFloatingLayout | null {
    if (options.layoutId === undefined || this.modal) {
      return null;
    }
    return new PanelFloatingLayout(this, this.root, {
      layoutId: options.layoutId,
      restoresOpen: options.layoutRestoresOpen === true,
    });
  }

  /**
   * Mounts the shell under the host and places it at its remembered rect, or at
   * its default place.
   */
  private floatingMount(): void {
    this.mountShellIntoHost();
    this.positionDefaultIfNeeded();
    if (this.layout?.floatingRectRestore() === true) {
      this.hasFreeFirstPlacement = true;
      this.freeFirstPlacementRetryStop();
    }
    this.clampToScreenIfNeeded();
  }

  /** Takes the shell out of its dock or out of the host. */
  private unmountShell(): void {
    if (this.layout?.isMountedDocked() === true) {
      this.layout.dockedUnmount();
      this.root.style.display = 'none';
      return;
    }
    this.unmountShellFromHost();
  }

  /** Mounts the shell under the host (backdrop + root when modal). */
  private mountShellIntoHost(): void {
    if (this.isShellMounted) {
      return;
    }
    if (this.backdrop) {
      if (this.root.parentElement !== this.backdrop) {
        this.backdrop.appendChild(this.root);
      }
      this.host.appendChild(this.backdrop);
    } else {
      this.host.appendChild(this.root);
    }
    this.isShellMounted = true;
  }

  /** Removes the outermost shell node from the document. */
  private unmountShellFromHost(): void {
    if (!this.isShellMounted) {
      return;
    }
    if (this.backdrop) {
      this.backdrop.remove();
    } else {
      this.root.remove();
    }
    this.isShellMounted = false;
    this.root.style.display = 'none';
    if (this.backdrop) {
      this.backdrop.style.display = 'none';
    }
  }

  /** Applies display styles used while the panel is open. */
  private applyVisibleDisplayStyles(): void {
    this.root.style.display = 'flex';
    if (this.backdrop) {
      this.backdrop.style.display = 'flex';
    }
  }

  /**
   * Positions a corner panel at its corner, places a free beside or centered
   * panel on its first placement only, and leaves flex-centered modal panels
   * alone.
   */
  private positionDefaultIfNeeded(): void {
    if (this.centered && this.modal) {
      return;
    }
    if (this.besideResolver || this.centered) {
      this.positionFreeOnFirstPlacement();
      return;
    }
    this.positionDefault();
  }

  /**
   * Places a free panel beside its element, or centers it in its placement
   * anchor, the first time it is placed, keeping any later (dragged) position
   * afterwards.
   */
  private positionFreeOnFirstPlacement(): void {
    if (this.hasFreeFirstPlacement) {
      return;
    }
    const bounds = this.resolvePlacementAnchor().getBoundingClientRect();
    this.freeFirstPlacementApply(bounds);
    if (placementAnchorRectIsDegenerate(bounds)) {
      this.freeFirstPlacementRetryScheduleIfNeeded();
      return;
    }
    this.hasFreeFirstPlacement = true;
    this.freeFirstPlacementRetryStop();
  }

  /**
   * Places the panel from the current fallback bounds and panel size.
   *
   * @param bounds Placement-anchor rect used as the fallback.
   */
  private freeFirstPlacementApply(bounds: DOMRect): void {
    const size = this.resolvePanelSizeForPlacement();
    const placed = this.freeFirstPlacementCompute(bounds, size.width, size.height);
    this.setTopLeftPosition(placed.left, placed.top);
  }

  /**
   * Computes the first free placement from fallback bounds and panel size.
   *
   * @param bounds Placement-anchor rect used as the fallback.
   * @param panelWidth Panel width in CSS pixels.
   * @param panelHeight Panel height in CSS pixels.
   * @returns Unclamped left/top of the panel.
   */
  private freeFirstPlacementCompute(
    bounds: DOMRect,
    panelWidth: number,
    panelHeight: number,
  ): { left: number; top: number } {
    return floatingPanelBesidePlacementCompute({
      besideRect: floatingPanelBesideRectRead(this.besideResolver?.() ?? null),
      fallbackBounds: bounds,
      panelWidth,
      panelHeight,
      screenWidth: window.innerWidth,
      screenPaddingPx: this.paddingPx,
      gapPx: FLOATING_PANEL_BESIDE_GAP_PX,
    });
  }

  /** Cancels a pending first-placement retry so it cannot fire after hide. */
  private freeFirstPlacementRetryStop(): void {
    freeFirstPlacementRetryCancel(this.freeFirstPlacementRetryFrameId);
    this.freeFirstPlacementRetryFrameId = null;
    this.freeFirstPlacementRetryCount = 0;
  }

  /** Schedules another first-placement retry while the panel is still open. */
  private freeFirstPlacementRetryScheduleIfNeeded(): void {
    if (this.freeFirstPlacementRetryFrameId !== null) {
      return;
    }
    if (!this.isVisible || !freeFirstPlacementRetryRemaining(this.freeFirstPlacementRetryCount)) {
      return;
    }
    this.freeFirstPlacementRetryCount += 1;
    this.freeFirstPlacementRetryFrameId = freeFirstPlacementRetrySchedule(() => this.freeFirstPlacementRetryRun());
  }

  /** Re-runs first placement after a degenerate-anchor frame. */
  private freeFirstPlacementRetryRun(): void {
    this.freeFirstPlacementRetryFrameId = null;
    if (!this.isVisible || this.hasFreeFirstPlacement) {
      return;
    }
    this.positionFreeOnFirstPlacement();
    this.clampToScreenIfNeeded();
  }

  /** Clamps free-positioned panels into the screen. */
  private clampToScreenIfNeeded(): void {
    if (this.centered && this.modal) {
      return;
    }
    this.clampToScreen();
  }

  /**
   * Creates the shell root element; subclasses fill it after super().
   *
   * @returns Empty flex column root (hidden).
   */
  private createShellRoot(): HTMLElement {
    const root = document.createElement('div');
    root.style.display = 'none';
    root.style.flexDirection = 'column';
    root.style.userSelect = 'none';
    if (this.modal && this.centered) {
      root.style.position = 'relative';
    } else {
      root.style.position = 'fixed';
    }
    return root;
  }

  /**
   * Creates a full-screen modal backdrop for dialogs.
   *
   * @param options Floating panel options with optional backdrop chrome.
   * @returns Hidden backdrop element.
   */
  private createModalBackdrop(options: FloatingPanelOptions): HTMLElement {
    const backdrop = document.createElement('div');
    if (options.backdropClassName) {
      backdrop.className = options.backdropClassName;
    }
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.display = 'none';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.padding = '24px';
    backdrop.style.background = options.backdropBackground ?? Theme.modalBackdropColor;
    backdrop.style.boxSizing = 'border-box';
    if (this.closeOnBackdropClick) {
      backdrop.addEventListener('pointerdown', (event) => this.onBackdropPointerDown(event));
    }
    return backdrop;
  }

  /**
   * Closes the panel when the user presses the backdrop outside the card.
   *
   * @param event Pointer event on the backdrop.
   */
  private onBackdropPointerDown(event: PointerEvent): void {
    if (!this.backdrop || event.target !== this.backdrop) {
      return;
    }
    this.hide(true);
  }

  /** Raises this panel when the user interacts with it. */
  private bindBringToFrontOnPointer(): void {
    this.getStackElement().addEventListener('pointerdown', () => {
      FloatingPanelStack.bringToFront(this.getStackElement(), this.stackLayer);
    });
  }

  /** Installs document Escape handling while the panel is open. */
  private bindEscapeWhileOpen(): void {
    if (!this.closeOnEscape) {
      return;
    }
    document.addEventListener('keydown', this.boundDocumentKeyDown);
  }

  /** Removes document Escape handling. */
  private unbindEscapeWhileOpen(): void {
    if (!this.closeOnEscape) {
      return;
    }
    document.removeEventListener('keydown', this.boundDocumentKeyDown);
  }

  /**
   * Handles Escape dismiss while open.
   *
   * @param event Document keydown event.
   */
  private onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.isDocked()) {
      return;
    }
    event.preventDefault();
    this.hide(true);
  }

  /**
   * Creates the title bar drag of this window.
   *
   * @returns Title bar drag.
   */
  private titleDragCreate(): PanelFloatingTitleDrag {
    return new PanelFloatingTitleDrag({
      root: this.root,
      paddingPx: this.paddingPx,
      dragStarted: () => this.titleDragStarted(),
      positionSet: (left, top) => this.setTopLeftPosition(left, top),
      dragMoved: (event) => this.layout?.titleDragMove(event),
      dragEnded: (event) => this.titleDragEnded(event),
    });
  }

  /** Raises the window and keeps its dragged position on later opens. */
  private titleDragStarted(): void {
    this.hasFreeFirstPlacement = true;
    this.freeFirstPlacementRetryStop();
    FloatingPanelStack.bringToFront(this.getStackElement(), this.stackLayer);
  }

  /**
   * Docks the window when the drag ended over a dock target, or else clamps it
   * to the screen and remembers its rect.
   *
   * @param event Pointer release.
   */
  private titleDragEnded(event: PointerEvent): void {
    if (this.layout?.titleDragEnd(event) === true) {
      return;
    }
    this.clampToScreen();
    this.layout?.floatingRectSave();
  }

  /** Places the panel at the configured corner of the live placement anchor. */
  private positionDefault(): void {
    const anchor = this.resolvePlacementAnchor();
    const rect = anchor.getBoundingClientRect();
    const size = this.resolvePanelSizeForPlacement();
    const leftTop = this.computeDefaultLeftTop(rect, size.width, size.height);
    this.setTopLeftPosition(leftTop.left, leftTop.top);
  }

  /**
   * Resolves the element used for default corner placement.
   *
   * @returns Anchor container for placement (never null).
   */
  private resolvePlacementAnchor(): HTMLElement {
    const liveAnchor = this.defaultAnchorResolver?.() ?? null;
    if (liveAnchor) {
      this.defaultAnchor = liveAnchor;
      return liveAnchor;
    }
    if (this.defaultAnchor?.isConnected) {
      return this.defaultAnchor;
    }
    this.defaultAnchor = null;
    return this.host;
  }

  /**
   * Resolves panel size for corner placement, preferring live layout then CSS.
   *
   * @returns Width and height in CSS pixels.
   */
  private resolvePanelSizeForPlacement(): { width: number; height: number } {
    const size = this.root.getBoundingClientRect();
    if (size.width > 0 && size.height > 0) {
      return { width: size.width, height: size.height };
    }
    const styleWidth = parseFloat(this.root.style.width);
    const styleHeight = parseFloat(this.root.style.height);
    return {
      width: Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : 212,
      height: Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : 200,
    };
  }

  /**
   * Computes default left/top for the configured corner inside an anchor rect.
   *
   * @param anchorRect Anchor getBoundingClientRect.
   * @param panelWidth Panel width in CSS pixels.
   * @param panelHeight Panel height in CSS pixels.
   * @returns Unclamped left/top.
   */
  private computeDefaultLeftTop(
    anchorRect: DOMRect,
    panelWidth: number,
    panelHeight: number,
  ): { left: number; top: number } {
    const pad = this.paddingPx;
    if (this.corner === 'top-left') {
      const topInset = this.insetBelowViewportToolbar ? Theme.viewportLabelHeightPx + pad : pad;
      return { left: anchorRect.left + pad, top: anchorRect.top + topInset };
    }
    if (this.corner === 'bottom-left') {
      return {
        left: anchorRect.left + pad,
        top: anchorRect.bottom - panelHeight - pad,
      };
    }
    return {
      left: anchorRect.right - panelWidth - pad,
      top: anchorRect.bottom - panelHeight - pad,
    };
  }
}
