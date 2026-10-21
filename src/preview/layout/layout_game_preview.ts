import type * as THREE from 'three';
import { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import { PanelGamePreview } from '@/preview/ui/panel_game_preview.js';
import type { PreviewCatalogEntries } from '@/preview/catalog/preview_catalog_entries.js';
import { previewCatalogMaterialsRebind } from '@/preview/catalog/preview_catalog_material_rebind.js';
import type { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';

/** Texture browser folder name shown for the game material catalog. */
export const LAYOUT_GAME_PREVIEW_CATALOG_FOLDER_NAME = 'Game materials';

/** Level name used before the scene has been saved to a file. */
export const LAYOUT_GAME_PREVIEW_FALLBACK_LEVEL_NAME = 'untitled';

/** Editor collaborators the game preview layout needs. */
export interface LayoutGamePreviewHosts {
  /** Editor world root mirrored into the game. */
  worldGroup: THREE.Group;
  /** Element the floating panel is mounted in. */
  panelHost: HTMLElement;
  /** Returns the texture browser controller, or null while it does not exist. */
  textureBrowserControllerRead: () => ControllerTextureBrowser | null;
  /** Returns the file name of the current scene document, or null when unsaved. */
  sceneFileNameRead: () => string | null;
  /** Shows a short message in the status bar. */
  statusMessageShow: (message: string) => void;
}

/**
 * Lazily creates the game preview link and its floating panel, and applies the
 * game material catalog to the texture browser and to existing materials.
 */
export class LayoutGamePreview {
  private readonly hosts: LayoutGamePreviewHosts;
  private service: PreviewLinkService | null = null;
  private panel: PanelGamePreview | null = null;

  /**
   * Creates the layout helper without creating the link.
   *
   * @param hosts Editor collaborators.
   */
  constructor(hosts: LayoutGamePreviewHosts) {
    this.hosts = hosts;
  }

  /** Shows or hides the game preview panel, creating it on first use. */
  panelToggle(): void {
    this.panelEnsure().toggle();
  }

  /**
   * Returns the preview link service, creating it on first use.
   *
   * @returns The shared service.
   */
  serviceEnsure(): PreviewLinkService {
    if (!this.service) {
      this.service = new PreviewLinkService(this.hosts.worldGroup, {
        onCatalogLoaded: (catalog) => this.catalogApply(catalog),
        levelNameProvider: () => this.levelNameRead(),
      });
    }
    return this.service;
  }

  /**
   * Returns the level name derived from the scene file name.
   *
   * @returns Lowercase name made of letters, digits, dashes and underscores.
   */
  levelNameRead(): string {
    return layoutGamePreviewLevelNameFromFileName(this.hosts.sceneFileNameRead());
  }

  /**
   * Shows the catalog in the texture browser and refreshes materials already
   * using one of its ids.
   *
   * @param catalog Loaded game material catalog.
   */
  catalogApply(catalog: PreviewCatalogEntries): void {
    this.hosts.textureBrowserControllerRead()?.applyEntries(LAYOUT_GAME_PREVIEW_CATALOG_FOLDER_NAME, catalog.entries);
    const identifiers = new Set(catalog.entries.map((entry) => entry.id));
    previewCatalogMaterialsRebind(this.hosts.worldGroup, identifiers, getTextureMapCache());
    this.hosts.statusMessageShow(catalog.error !== '' ? catalog.error : `Game materials: ${catalog.entries.length}`);
  }

  /**
   * Returns the panel, creating it on first use.
   *
   * @returns The floating panel.
   */
  private panelEnsure(): PanelGamePreview {
    if (!this.panel) {
      this.panel = new PanelGamePreview(this.hosts.panelHost, this.serviceEnsure());
    }
    return this.panel;
  }
}

/**
 * Turns a scene file name into a level name the game can use as a file name.
 *
 * @param fileName Scene file name, or null when unsaved.
 * @returns Sanitized level name, or the fallback name.
 */
export function layoutGamePreviewLevelNameFromFileName(fileName: string | null): string {
  const withoutExtension = (fileName ?? '').replace(/\.[^.]*$/, '');
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized || LAYOUT_GAME_PREVIEW_FALLBACK_LEVEL_NAME;
}
