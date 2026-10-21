import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserDragGhost } from '@/entity_browser/drag/entity_browser_drag_ghost.js';

/** Pointer travel in CSS pixels before a press on a tile becomes a drag. */
export const ENTITY_BROWSER_DRAG_THRESHOLD_PX = 4;

/** What a drag session needs from the browser. */
export interface EntityBrowserDragHost {
  /** Browser element; releasing over it cancels the drag. */
  readonly sourceElement: HTMLElement;
  /**
   * Returns whether releasing at a client point places the entry.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns True over a placement target.
   */
  placementTargetCheck(clientX: number, clientY: number): boolean;
  /**
   * Places the dragged entry at a client point.
   *
   * @param entry Dragged catalog entry.
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   */
  drop(entry: EntityBrowserCatalogEntry, clientX: number, clientY: number): void;
  /** Runs when the session ended, dropped or not. */
  ended(): void;
}

/**
 * Follows one press on a tile: once the pointer travels past a threshold a
 * ghost follows it, and releasing over a placement target outside the browser
 * places the entry there. Escape or a cancelled pointer abort the drag.
 */
export class EntityBrowserDragSession {
  private readonly host: EntityBrowserDragHost;
  private readonly entry: EntityBrowserCatalogEntry;
  private readonly ownerDocument: Document;
  private readonly startX: number;
  private readonly startY: number;
  private ghost: EntityBrowserDragGhost | null = null;
  private readonly abortController = new AbortController();

  /**
   * Starts following a press on a tile.
   *
   * @param host Browser callbacks.
   * @param entry Pressed catalog entry.
   * @param pressEvent Pointer press on the tile.
   */
  constructor(host: EntityBrowserDragHost, entry: EntityBrowserCatalogEntry, pressEvent: PointerEvent) {
    this.host = host;
    this.entry = entry;
    this.ownerDocument = host.sourceElement.ownerDocument;
    this.startX = pressEvent.clientX;
    this.startY = pressEvent.clientY;
    this.documentListenersAdd();
  }

  /**
   * Returns whether the press already turned into a drag.
   *
   * @returns True while the ghost follows the pointer.
   */
  isDragging(): boolean {
    return this.ghost !== null;
  }

  /** Stops following the pointer and removes the ghost without placing. */
  cancel(): void {
    this.abortController.abort();
    this.ghost?.dispose();
    this.ghost = null;
    this.host.ended();
  }

  /** Listens for pointer moves, releases and Escape anywhere in the document. */
  private documentListenersAdd(): void {
    const options = { signal: this.abortController.signal, capture: true };
    this.ownerDocument.addEventListener('pointermove', (event) => this.pointerMoved(event), options);
    this.ownerDocument.addEventListener('pointerup', (event) => this.pointerReleased(event), options);
    this.ownerDocument.addEventListener('pointercancel', () => this.cancel(), options);
    this.ownerDocument.addEventListener('keydown', (event) => this.keyPressed(event), options);
  }

  /**
   * Starts the drag past the threshold and moves the ghost.
   *
   * @param event Pointer move.
   */
  private pointerMoved(event: PointerEvent): void {
    if (this.ghost === null && !this.thresholdPassed(event.clientX, event.clientY)) {
      return;
    }
    this.ghost ??= new EntityBrowserDragGhost(this.ownerDocument, this.entry);
    this.ghost.moveTo(event.clientX, event.clientY, this.dropTargetCheck(event));
  }

  /**
   * Places the entry when a drag ends over a target, then ends the session.
   *
   * @param event Pointer release.
   */
  private pointerReleased(event: PointerEvent): void {
    const shouldDrop = this.ghost !== null && this.dropTargetCheck(event);
    this.cancel();
    if (shouldDrop) {
      this.host.drop(this.entry, event.clientX, event.clientY);
    }
  }

  /**
   * Aborts the drag on Escape.
   *
   * @param event Key press.
   */
  private keyPressed(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.ghost === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
  }

  /**
   * Returns whether a pointer event is over a placement target outside the
   * browser.
   *
   * @param event Pointer event.
   * @returns True when releasing here places the entry.
   */
  private dropTargetCheck(event: PointerEvent): boolean {
    const target = event.target;
    if (target instanceof Node && this.host.sourceElement.contains(target)) {
      return false;
    }
    return this.host.placementTargetCheck(event.clientX, event.clientY);
  }

  /**
   * Returns whether the pointer travelled far enough to start a drag.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns True past the drag threshold.
   */
  private thresholdPassed(clientX: number, clientY: number): boolean {
    return Math.hypot(clientX - this.startX, clientY - this.startY) >= ENTITY_BROWSER_DRAG_THRESHOLD_PX;
  }
}
