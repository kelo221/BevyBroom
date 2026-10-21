import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { WindowPointerDragSession } from '@/utils/session_window_pointer_drag.js';

/** `horizontal` places the panes side by side; `vertical` stacks them. */
export type SplitterBoxOrientation = 'horizontal' | 'vertical';

/** Which pane keeps a fixed pixel size while the other takes the rest. */
export type SplitterBoxSizedPane = 'first' | 'second';

/** Options for one splitter box. */
export interface SplitterBoxOptions {
  orientation: SplitterBoxOrientation;
  sizedPane: SplitterBoxSizedPane;
  /** Starting size of the sized pane in CSS pixels. */
  initialSizePx: number;
  /** Smallest size of the sized pane in CSS pixels. */
  minSizedPx: number;
  /** Smallest size of the flexible pane in CSS pixels. */
  minFlexiblePx: number;
  /** Document that creates the elements; defaults to the global document. */
  ownerDocument?: Document;
}

/** Listener told the sized pane's new size and collapsed state. */
export type SplitterBoxChangeListener = (sizePx: number, isCollapsed: boolean) => void;

/** Thickness of the draggable divider in CSS pixels. */
export const SPLITTER_BOX_DIVIDER_PX = Theme.separatorGapPx;

/** Two panes with a draggable divider; one pane has a pixel size, one flexes. */
export class SplitterBox {
  private readonly options: SplitterBoxOptions;
  private readonly ownerDocument: Document;
  private readonly root: HTMLElement;
  private readonly firstPane: HTMLElement;
  private readonly secondPane: HTMLElement;
  private readonly divider: HTMLElement;
  private readonly dragSession: WindowPointerDragSession;
  private readonly listeners: Set<SplitterBoxChangeListener>;
  private sizePx: number;
  private isCollapsed: boolean;

  /**
   * Creates a splitter box with two empty panes.
   *
   * @param options Orientation, sized pane, sizes and document.
   */
  constructor(options: SplitterBoxOptions) {
    this.options = options;
    this.ownerDocument = options.ownerDocument ?? document;
    this.dragSession = new WindowPointerDragSession();
    this.listeners = new Set();
    this.sizePx = Math.max(options.minSizedPx, options.initialSizePx);
    this.isCollapsed = false;
    this.root = this.rootCreate();
    this.firstPane = this.paneCreate('first');
    this.secondPane = this.paneCreate('second');
    this.divider = this.dividerCreate();
    this.root.append(this.firstPane, this.divider, this.secondPane);
    this.sizeApply();
  }

  /**
   * Returns the root element holding both panes.
   *
   * @returns Splitter root.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the left or top pane.
   *
   * @returns First pane element.
   */
  getFirstPane(): HTMLElement {
    return this.firstPane;
  }

  /**
   * Returns the right or bottom pane.
   *
   * @returns Second pane element.
   */
  getSecondPane(): HTMLElement {
    return this.secondPane;
  }

  /**
   * Returns the size of the sized pane.
   *
   * @returns Size in CSS pixels, kept while the pane is collapsed.
   */
  getSizedPaneSizePx(): number {
    return this.sizePx;
  }

  /**
   * Returns whether the sized pane is collapsed.
   *
   * @returns True while the sized pane and the divider are hidden.
   */
  isSizedPaneCollapsed(): boolean {
    return this.isCollapsed;
  }

  /**
   * Sets the size of the sized pane, kept within both minimum sizes.
   *
   * @param sizePx Requested size in CSS pixels.
   */
  setSizedPaneSizePx(sizePx: number): void {
    const clamped = this.sizeClamp(sizePx);
    if (clamped === this.sizePx) {
      return;
    }
    this.sizePx = clamped;
    this.sizeApply();
    this.listenersNotify();
  }

  /**
   * Hides or shows the sized pane together with the divider.
   *
   * @param isCollapsed True to hide the sized pane.
   */
  setSizedPaneCollapsed(isCollapsed: boolean): void {
    if (isCollapsed === this.isCollapsed) {
      return;
    }
    this.isCollapsed = isCollapsed;
    this.sizeApply();
    this.listenersNotify();
  }

  /**
   * Registers a listener for size and collapse changes.
   *
   * @param listener Called with the new size and collapsed state.
   * @returns Function that removes the listener.
   */
  changeListenerAdd(listener: SplitterBoxChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Ends any drag and removes the splitter from the document. */
  dispose(): void {
    this.dragSession.end();
    this.listeners.clear();
    this.root.remove();
  }

  /**
   * Returns whether the panes sit side by side.
   *
   * @returns True for the horizontal orientation.
   */
  private isHorizontal(): boolean {
    return this.options.orientation === 'horizontal';
  }

  /**
   * Returns the pane that holds the fixed size.
   *
   * @returns Sized pane element.
   */
  private sizedPaneElement(): HTMLElement {
    return this.options.sizedPane === 'first' ? this.firstPane : this.secondPane;
  }

  /**
   * Returns the pane that takes the remaining space.
   *
   * @returns Flexible pane element.
   */
  private flexiblePaneElement(): HTMLElement {
    return this.options.sizedPane === 'first' ? this.secondPane : this.firstPane;
  }

  /**
   * Creates the flex container.
   *
   * @returns Root element.
   */
  private rootCreate(): HTMLElement {
    const root = this.ownerDocument.createElement('div');
    root.className = `splitter-box splitter-box-${this.options.orientation}`;
    root.style.display = 'flex';
    root.style.flexDirection = this.isHorizontal() ? 'row' : 'column';
    root.style.flex = '1 1 auto';
    root.style.minWidth = '0';
    root.style.minHeight = '0';
    root.style.overflow = 'hidden';
    return root;
  }

  /**
   * Creates one pane container.
   *
   * @param position First or second pane.
   * @returns Pane element.
   */
  private paneCreate(position: SplitterBoxSizedPane): HTMLElement {
    const pane = this.ownerDocument.createElement('div');
    pane.className = `splitter-box-pane splitter-box-pane-${position}`;
    pane.style.display = 'flex';
    pane.style.flexDirection = 'column';
    pane.style.position = 'relative';
    pane.style.minWidth = '0';
    pane.style.minHeight = '0';
    pane.style.overflow = 'hidden';
    return pane;
  }

  /**
   * Creates the draggable divider between the panes.
   *
   * @returns Divider element.
   */
  private dividerCreate(): HTMLElement {
    const divider = this.ownerDocument.createElement('div');
    divider.className = 'splitter-box-divider';
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-orientation', this.isHorizontal() ? 'vertical' : 'horizontal');
    divider.style.flex = `0 0 ${SPLITTER_BOX_DIVIDER_PX}px`;
    divider.style.background = hexToRgb(Theme.separatorColor);
    divider.style.cursor = this.isHorizontal() ? 'col-resize' : 'row-resize';
    divider.addEventListener('pointerdown', (event) => this.dividerDragBegin(event));
    return divider;
  }

  /** Writes the sized pane size and the collapsed state into the styles. */
  private sizeApply(): void {
    const sized = this.sizedPaneElement();
    sized.style.flex = `0 0 ${this.sizePx}px`;
    sized.style.display = this.isCollapsed ? 'none' : 'flex';
    this.divider.style.display = this.isCollapsed ? 'none' : 'block';
    const flexible = this.flexiblePaneElement();
    flexible.style.flex = '1 1 0px';
    const minimumKey = this.isHorizontal() ? 'minWidth' : 'minHeight';
    sized.style[minimumKey] = `${this.options.minSizedPx}px`;
    flexible.style[minimumKey] = `${this.options.minFlexiblePx}px`;
  }

  /**
   * Keeps a requested size within the sized minimum and, once the root has a
   * measured size, within the room left by the flexible minimum.
   *
   * @param sizePx Requested size in CSS pixels.
   * @returns Clamped size in whole pixels.
   */
  private sizeClamp(sizePx: number): number {
    const span = this.rootSpanPx();
    const maximum = span > 0 ? span - this.options.minFlexiblePx - SPLITTER_BOX_DIVIDER_PX : Number.POSITIVE_INFINITY;
    const bounded = Math.min(Math.max(sizePx, this.options.minSizedPx), Math.max(maximum, this.options.minSizedPx));
    return Math.round(bounded);
  }

  /**
   * Returns the root length along the split axis.
   *
   * @returns Width for horizontal boxes, height for vertical boxes, in pixels.
   */
  private rootSpanPx(): number {
    const rect = this.root.getBoundingClientRect();
    return this.isHorizontal() ? rect.width : rect.height;
  }

  /**
   * Starts resizing the sized pane from a primary button press on the divider.
   *
   * @param event Pointer down event on the divider.
   */
  private dividerDragBegin(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const startPointer = this.isHorizontal() ? event.clientX : event.clientY;
    const startSize = this.sizePx;
    const ownerWindow = this.ownerDocument.defaultView ?? window;
    this.dragSession.begin(
      (moveEvent) => this.dividerDragMove(moveEvent, startPointer, startSize),
      () => undefined,
      ownerWindow,
      { element: this.divider, pointerId: event.pointerId },
    );
  }

  /**
   * Resizes the sized pane while the divider is dragged.
   *
   * @param event Pointer move event.
   * @param startPointer Pointer coordinate along the split axis at drag start.
   * @param startSize Sized pane size at drag start.
   */
  private dividerDragMove(event: PointerEvent, startPointer: number, startSize: number): void {
    const pointer = this.isHorizontal() ? event.clientX : event.clientY;
    const travel = pointer - startPointer;
    const direction = this.options.sizedPane === 'first' ? 1 : -1;
    this.setSizedPaneSizePx(startSize + travel * direction);
  }

  /** Tells every listener the current size and collapsed state. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener(this.sizePx, this.isCollapsed));
  }
}
