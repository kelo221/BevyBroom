import { createTextureBrowserEntry, type TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import {
  PREVIEW_METHOD,
  type PreviewAssetReply,
  type PreviewCatalogMaterial,
  type PreviewCatalogReply,
} from '@/preview/protocol/preview_protocol_types.js';
import { base64ToBytes } from '@/utils/utils_base64.js';

/** Time a catalog or asset request may take. */
const PREVIEW_CATALOG_TIMEOUT_MILLISECONDS = 10000;

/** The game material catalog as texture browser entries. */
export interface PreviewCatalogEntries {
  /** One entry per game material; its id is the game material id. */
  entries: TextureBrowserEntry[];
  /** Catalog generation the entries were built from. */
  generation: number;
  /** Texture reload counter the entries were built from. */
  textureGeneration: number;
  /** Error reported by the game for a broken catalog file, empty when fine. */
  error: string;
}

/** Catalog reply including the texture reload counter. */
interface PreviewCatalogReplyWithTextures extends PreviewCatalogReply {
  texture_generation?: number;
}

/**
 * Reads the game material catalog through the bridge and turns each material
 * into a texture browser entry previewing its base color texture, or a plain
 * swatch of its base color when it has none.
 */
export class PreviewCatalogEntryLoader {
  /**
   * Loads the catalog and every base color texture.
   *
   * @param transport Bridge transport.
   * @returns Catalog entries.
   */
  static async load(transport: PreviewLinkTransport): Promise<PreviewCatalogEntries> {
    const reply = await PreviewCatalogEntryLoader.catalogFetch(transport);
    const materials = reply.catalog?.materials ?? [];
    const entries = await Promise.all(
      materials.map((material) => PreviewCatalogEntryLoader.entryCreate(transport, material)),
    );
    return {
      entries,
      generation: reply.generation,
      textureGeneration: reply.texture_generation ?? 0,
      error: reply.error ?? '',
    };
  }

  /**
   * Fetches the catalog reply.
   *
   * @param transport Bridge transport.
   * @returns Catalog reply.
   */
  static catalogFetch(transport: PreviewLinkTransport): Promise<PreviewCatalogReplyWithTextures> {
    return transport.call<PreviewCatalogReplyWithTextures>(
      PREVIEW_METHOD.catalog,
      null,
      PREVIEW_CATALOG_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Builds the entry of one game material.
   *
   * @param transport Bridge transport.
   * @param material Catalog material.
   * @returns Texture browser entry whose id is the game material id.
   */
  private static async entryCreate(
    transport: PreviewLinkTransport,
    material: PreviewCatalogMaterial,
  ): Promise<TextureBrowserEntry> {
    const file = material.base_color_texture
      ? await PreviewCatalogEntryLoader.textureFileRead(transport, material.base_color_texture)
      : PreviewCatalogEntryLoader.swatchFileCreate(material);
    const entry = createTextureBrowserEntry(file, material.id);
    entry.displayName = material.label || material.id;
    return entry;
  }

  /**
   * Reads one texture file of the game's asset folder.
   *
   * @param transport Bridge transport.
   * @param assetPath Path relative to the game's asset root.
   * @returns The texture as a browser File.
   */
  private static async textureFileRead(transport: PreviewLinkTransport, assetPath: string): Promise<File> {
    const reply = await transport.call<PreviewAssetReply>(
      PREVIEW_METHOD.readAsset,
      { path: assetPath },
      PREVIEW_CATALOG_TIMEOUT_MILLISECONDS,
    );
    const fileName = assetPath.split('/').pop() ?? assetPath;
    return new File([base64ToBytes(reply.base64)], fileName, { type: previewCatalogMimeType(fileName) });
  }

  /**
   * Creates a small image file filled with a material's base color.
   *
   * @param material Catalog material without a base color texture.
   * @returns SVG swatch file.
   */
  private static swatchFileCreate(material: PreviewCatalogMaterial): File {
    const [red, green, blue] = material.base_color.map((channel) =>
      Math.round(Math.max(0, Math.min(1, channel)) * 255),
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="rgb(${red},${green},${blue})"/></svg>`;
    return new File([svg], `${material.id.replaceAll('/', '_')}.svg`, { type: 'image/svg+xml' });
  }
}

/**
 * Returns the MIME type of an image file name.
 *
 * @param fileName File name with extension.
 * @returns MIME type, defaulting to PNG.
 */
export function previewCatalogMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/png';
}
