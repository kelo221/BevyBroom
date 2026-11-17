import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserPreviewOrbit } from '@/entity_browser/preview/entity_browser_preview_orbit.js';
import type { EntityBrowserPreviewStudio } from '@/entity_browser/preview/entity_browser_preview_studio.js';
import {
  entityBrowserStylePreviewCanvas,
  entityBrowserStylePreviewCaption,
  entityBrowserStylePreviewMessage,
  entityBrowserStylePreviewPane,
} from '@/entity_browser/ui/entity_browser_styles_preview.js';

/** Message shown when the browser cannot draw in 3D. */
export const ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_UNAVAILABLE = '3D preview unavailable';

/** Message shown when no tile is selected. */
export const ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_EMPTY = 'Select a tile';

/** Message shown when the selected kind has no meshes to preview. */
export const ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_NO_PREVIEW = 'No 3D preview';

/**
 * Single 3D tile: one large live 3D view of the selected kind's meshes. Drag to
 * orbit, wheel to zoom, double-click to return to the fresh view.
 */
export class EntityBrowserPreviewPane {
  readonly element: HTMLElement;
  readonly orbit = new EntityBrowserPreviewOrbit();
  private readonly studio: EntityBrowserPreviewStudio;
  private readonly caption: HTMLElement;
  private readonly message: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private entry: EntityBrowserCatalogEntry | null = null;
  private dragPointerId: number | null = null;
  private dragLastX = 0;
  private dragLastY = 0;

  /**
   * Creates the pane; it draws once mounted and sized.
   *
   * @param ownerDocument Document that owns the pane.
   * @param studio Studio that builds and draws the previews.
   */
  constructor(ownerDocument: Document, studio: EntityBrowserPreviewStudio) {
    this.studio = studio;
    this.element = ownerDocument.createElement('div');
    this.element.className = 'entity-browser-preview-pane';
    entityBrowserStylePreviewPane(this.element);
    this.caption = ownerDocument.createElement('div');
    entityBrowserStylePreviewCaption(this.caption);
    this.message = ownerDocument.createElement('div');
    entityBrowserStylePreviewMessage(this.message);
    this.element.append(this.caption, this.message);
    this.resizeObserver = this.resizeObserverCreate(ownerDocument);
    this.listenersAdd();
  }

  /**
   * Shows an entry, starting from the fresh view when it differs from the shown
   * one.
   *
   * @param entry Catalog entry, or null for none.
   */
  entryShow(entry: EntityBrowserCatalogEntry | null): void {
    if (entry?.id !== this.entry?.id) {
      this.orbit.reset();
    }
    this.entry = entry;
    this.caption.textContent = entry?.label ?? '';
    this.caption.style.display = entry === null ? 'none' : '';
    this.redraw();
  }

  /**
   * Returns the shown entry.
   *
   * @returns Catalog entry, or null.
   */
  entryRead(): EntityBrowserCatalogEntry | null {
    return this.entry;
  }

  /**
   * Returns the message shown over the view.
   *
   * @returns Message text; empty while the view draws the kind.
   */
  messageRead(): string {
    return this.message.textContent ?? '';
  }

  /**
   * Draws the shown entry at the pane's current size when the pane is on
   * screen.
   */
  redraw(): void {
    if (!this.element.isConnected) {
      return;
    }
    const renderer = this.studio.rendererRead();
    if (renderer === null) {
      this.messageShow(ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_UNAVAILABLE);
      return;
    }
    this.canvasMount(renderer.canvas);
    this.messageShow(this.messageForEntry());
    this.studio.liveDraw(this.entry, this.orbit, this.element.clientWidth, this.element.clientHeight);
  }

  /** Stops following size changes. */
  dispose(): void {
    this.resizeObserver?.disconnect();
  }

  /**
   * Returns the message for the shown entry.
   *
   * @returns Message text, or empty when the entry has meshes to draw.
   */
  private messageForEntry(): string {
    if (this.entry === null) {
      return ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_EMPTY;
    }
    return this.studio.subjectResolve(this.entry) === null ? ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_NO_PREVIEW : '';
  }

  /**
   * Shows a message over the view, or hides it when empty.
   *
   * @param text Message text.
   */
  private messageShow(text: string): void {
    this.message.textContent = text;
    this.message.style.display = text === '' ? 'none' : 'flex';
  }

  /**
   * Places the renderer canvas under the caption and message.
   *
   * @param canvas Renderer canvas.
   */
  private canvasMount(canvas: HTMLCanvasElement): void {
    if (canvas.parentElement === this.element) {
      return;
    }
    entityBrowserStylePreviewCanvas(canvas);
    this.element.insertBefore(canvas, this.element.firstChild);
  }

  /**
   * Creates the observer that redraws after the pane changed size.
   *
   * @param ownerDocument Document whose window provides the observer.
   * @returns Observer, or null when the window has none.
   */
  private resizeObserverCreate(ownerDocument: Document): ResizeObserver | null {
    const ObserverClass = ownerDocument.defaultView?.ResizeObserver;
    if (ObserverClass === undefined) {
      return null;
    }
    const observer = new ObserverClass(() => this.redraw());
    observer.observe(this.element);
    return observer;
  }

  /** Routes drags, wheel turns and double-clicks to the orbit. */
  private listenersAdd(): void {
    this.element.addEventListener('pointerdown', (event) => this.dragStart(event));
    this.element.addEventListener('pointermove', (event) => this.dragMove(event));
    this.element.addEventListener('pointerup', (event) => this.dragEnd(event));
    this.element.addEventListener('pointercancel', (event) => this.dragEnd(event));
    this.element.addEventListener('wheel', (event) => this.wheelTurned(event), { passive: false });
    this.element.addEventListener('dblclick', () => this.viewReset());
  }

  /**
   * Starts orbiting on a primary-button press.
   *
   * @param event Pointer press.
   */
  private dragStart(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.dragPointerId = event.pointerId;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.element.setPointerCapture?.(event.pointerId);
    this.element.style.cursor = 'grabbing';
  }

  /**
   * Orbits by the pointer movement since the last event.
   *
   * @param event Pointer move.
   */
  private dragMove(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }
    this.orbit.dragBy(event.clientX - this.dragLastX, event.clientY - this.dragLastY);
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.redraw();
  }

  /**
   * Stops orbiting when the dragging pointer is released.
   *
   * @param event Pointer release or cancel.
   */
  private dragEnd(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }
    this.dragPointerId = null;
    this.element.releasePointerCapture?.(event.pointerId);
    this.element.style.cursor = 'grab';
  }

  /**
   * Zooms by a wheel turn.
   *
   * @param event Wheel event.
   */
  private wheelTurned(event: WheelEvent): void {
    event.preventDefault();
    this.orbit.zoomBy(event.deltaY);
    this.redraw();
  }

  /** Returns to the fresh view and redraws. */
  private viewReset(): void {
    this.orbit.reset();
    this.redraw();
  }
}
