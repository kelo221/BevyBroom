import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import {
  entityBrowserStyleDragGhost,
  entityBrowserStyleDragGhostTarget,
} from '@/entity_browser/ui/entity_browser_styles.js';
import { entityBrowserThumbnailCreate } from '@/entity_browser/ui/entity_browser_thumbnail.js';

/** Offset of the ghost from the pointer so it never hides the drop point. */
const ENTITY_BROWSER_DRAG_GHOST_OFFSET_PX = 12;

/** Thumbnail image that follows the pointer while a tile is dragged. */
export class EntityBrowserDragGhost {
  readonly element: HTMLElement;

  /**
   * Creates the ghost of a catalog entry and adds it to the document body.
   *
   * @param ownerDocument Document the pointer moves in.
   * @param entry Dragged catalog entry.
   */
  constructor(ownerDocument: Document, entry: EntityBrowserCatalogEntry) {
    this.element = ownerDocument.createElement('div');
    this.element.dataset['entityBrowserDragGhost'] = entry.id;
    entityBrowserStyleDragGhost(this.element);
    this.element.appendChild(entityBrowserThumbnailCreate(ownerDocument, entry));
    ownerDocument.body.appendChild(this.element);
  }

  /**
   * Moves the ghost next to the pointer and shows whether it is over a drop
   * target.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param isOverTarget True when dropping here places the entry.
   */
  moveTo(clientX: number, clientY: number, isOverTarget: boolean): void {
    const left = clientX + ENTITY_BROWSER_DRAG_GHOST_OFFSET_PX;
    const top = clientY + ENTITY_BROWSER_DRAG_GHOST_OFFSET_PX;
    this.element.style.transform = `translate(${left}px, ${top}px)`;
    entityBrowserStyleDragGhostTarget(this.element, isOverTarget);
  }

  /** Removes the ghost from the document. */
  dispose(): void {
    this.element.remove();
  }
}
