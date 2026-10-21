import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import {
  entityBrowserStyleTile,
  entityBrowserStyleTileLabel,
  entityBrowserStyleTileSelected,
  entityBrowserStyleUsageBadge,
} from '@/entity_browser/ui/entity_browser_styles.js';
import { entityBrowserThumbnailCreate } from '@/entity_browser/ui/entity_browser_thumbnail.js';

/** Data attribute holding the entry id on every tile element. */
export const ENTITY_BROWSER_TILE_ID_ATTRIBUTE = 'data-entity-browser-tile';

/** One tile of the entity browser: thumbnail, name and usage count. */
export class EntityBrowserTile {
  readonly entry: EntityBrowserCatalogEntry;
  readonly element: HTMLElement;
  private readonly usageBadge: HTMLElement;

  /**
   * Creates the tile of a catalog entry.
   *
   * @param ownerDocument Document that owns the tile.
   * @param entry Catalog entry the tile shows.
   * @param usageCount Number of objects of this kind in the map.
   */
  constructor(ownerDocument: Document, entry: EntityBrowserCatalogEntry, usageCount: number) {
    this.entry = entry;
    this.element = ownerDocument.createElement('div');
    this.element.setAttribute(ENTITY_BROWSER_TILE_ID_ATTRIBUTE, entry.id);
    this.element.setAttribute('role', 'option');
    entityBrowserStyleTile(this.element);
    this.usageBadge = ownerDocument.createElement('span');
    entityBrowserStyleUsageBadge(this.usageBadge);
    this.element.append(entityBrowserThumbnailCreate(ownerDocument, entry), this.labelCreate(ownerDocument));
    this.element.appendChild(this.usageBadge);
    this.usageCountSet(usageCount);
    this.selectedSet(false);
  }

  /**
   * Shows or hides the selection highlight.
   *
   * @param isSelected True for the selected tile.
   */
  selectedSet(isSelected: boolean): void {
    this.element.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    entityBrowserStyleTileSelected(this.element, isSelected);
  }

  /**
   * Shows how many objects of this kind the map holds, in the badge and the
   * tooltip.
   *
   * @param usageCount Number of objects of this kind.
   */
  usageCountSet(usageCount: number): void {
    this.usageBadge.textContent = usageCount > 0 ? String(usageCount) : '';
    this.usageBadge.style.display = usageCount > 0 ? '' : 'none';
    this.element.title = this.tooltipCompose(usageCount);
  }

  /**
   * Creates the name label under the thumbnail.
   *
   * @param ownerDocument Document that owns the label.
   * @returns Label element.
   */
  private labelCreate(ownerDocument: Document): HTMLElement {
    const label = ownerDocument.createElement('span');
    label.textContent = this.entry.label;
    entityBrowserStyleTileLabel(label);
    return label;
  }

  /**
   * Builds the hover text: name, category, extra help and usage count.
   *
   * @param usageCount Number of objects of this kind.
   * @returns Tooltip text.
   */
  private tooltipCompose(usageCount: number): string {
    const lines = [this.entry.label, this.entry.category];
    if (this.entry.tooltip !== '') {
      lines.push(this.entry.tooltip);
    }
    lines.push(`Used ${usageCount} time${usageCount === 1 ? '' : 's'} in this map`);
    return lines.join('\n');
  }
}
