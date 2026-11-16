import { iconSvgElementCreate } from '@/ui/icons/icon_svg.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { ENTITY_BROWSER_TILE_ICON_PX, entityBrowserStyleThumbnail } from '@/entity_browser/ui/entity_browser_styles.js';
import { entityBrowserStyleThumbnailImage } from '@/entity_browser/ui/entity_browser_styles_preview.js';

/** Data attribute set on thumbnails that show a rendered 3D image. */
export const ENTITY_BROWSER_THUMBNAIL_IMAGE_ATTRIBUTE = 'data-entity-browser-thumbnail-image';

/** Saturation of the category tinted thumbnail backgrounds, in percent. */
const ENTITY_BROWSER_THUMBNAIL_SATURATION = 32;

/** Lightness of the category tinted thumbnail backgrounds, in percent. */
const ENTITY_BROWSER_THUMBNAIL_LIGHTNESS = 24;

/**
 * Creates the thumbnail of a catalog entry: a rendered 3D image of its meshes
 * when one is given, otherwise its icon or first letter, on a background tinted
 * by its top-level category.
 *
 * @param ownerDocument Document that owns the element.
 * @param entry Catalog entry.
 * @param imageUrl Rendered 3D image of the entry, or null to show its icon.
 * @returns Thumbnail element.
 */
export function entityBrowserThumbnailCreate(
  ownerDocument: Document,
  entry: EntityBrowserCatalogEntry,
  imageUrl: string | null,
): HTMLElement {
  const thumbnail = ownerDocument.createElement('div');
  thumbnail.dataset['entityBrowserThumbnail'] = entry.id;
  entityBrowserStyleThumbnail(thumbnail, entityBrowserThumbnailBackground(entry.category));
  thumbnail.appendChild(
    imageUrl === null
      ? entityBrowserThumbnailGlyphCreate(ownerDocument, entry)
      : entityBrowserThumbnailImageCreate(ownerDocument, imageUrl),
  );
  return thumbnail;
}

/**
 * Creates the image element showing a rendered 3D image.
 *
 * @param ownerDocument Document that owns the element.
 * @param imageUrl Image data URL.
 * @returns Image element.
 */
function entityBrowserThumbnailImageCreate(ownerDocument: Document, imageUrl: string): HTMLElement {
  const image = ownerDocument.createElement('img');
  image.src = imageUrl;
  image.alt = '';
  image.draggable = false;
  image.setAttribute(ENTITY_BROWSER_THUMBNAIL_IMAGE_ATTRIBUTE, 'true');
  entityBrowserStyleThumbnailImage(image);
  return image;
}

/**
 * Creates the icon of an entry, or a letter when the entry has no icon.
 *
 * @param ownerDocument Document that owns the element.
 * @param entry Catalog entry.
 * @returns Glyph element.
 */
function entityBrowserThumbnailGlyphCreate(ownerDocument: Document, entry: EntityBrowserCatalogEntry): HTMLElement {
  const color = entry.iconColor ?? undefined;
  if (entry.iconName !== null) {
    return iconSvgElementCreate(ownerDocument, entry.iconName, ENTITY_BROWSER_TILE_ICON_PX, color);
  }
  const letter = ownerDocument.createElement('span');
  letter.textContent = entry.label.trim().charAt(0).toUpperCase();
  letter.style.color = color ?? '';
  return letter;
}

/**
 * Returns a dark background color whose hue follows the top-level category, so
 * tiles of one category share a tint.
 *
 * @param category Category path.
 * @returns CSS color.
 */
function entityBrowserThumbnailBackground(category: string): string {
  const topLevel = category.split('/')[0]?.trim() ?? category;
  let hash = 0;
  for (let index = 0; index < topLevel.length; index++) {
    hash = (hash * 31 + topLevel.charCodeAt(index)) % 360;
  }
  return `hsl(${hash}, ${ENTITY_BROWSER_THUMBNAIL_SATURATION}%, ${ENTITY_BROWSER_THUMBNAIL_LIGHTNESS}%)`;
}
