import type * as THREE from 'three';
import { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import { PanelGamePreview } from '@/preview/ui/panel_game_preview.js';
import type { PreviewCatalogEntries } from '@/preview/catalog/preview_catalog_entries.js';
import { previewCatalogMaterialsRebind } from '@/preview/catalog/preview_catalog_material_rebind.js';
import type { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS } from '@/texture/library/texture_library_source.js';
import { revokeTextureBrowserEntry, type TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { TextureProjectSourceLoader } from '@/texture/project/texture_project_source_loader.js';
import { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { ProjectWorkbenchLinkPreview } from '@/project/workbench/project_workbench_link_preview.js';
import { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { gameProcessControlResolve } from '@/project/control/game_process_control_desktop.js';
import { ControllerLevelBuild } from '@/level_build/controller_level_build.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import type { GameProfile } from '@/settings/store/settings_types.js';

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
  /** Returns the active game profile exports convert through, or null. */
  gameProfileRead: () => GameProfile | null;
}

/**
 * Lazily creates the game preview link and its floating panel, and applies the
 * game material catalog to the texture browser and to existing materials.
 */
export class LayoutGamePreview {
  private readonly hosts: LayoutGamePreviewHosts;
  private service: PreviewLinkService | null = null;
  private workbench: ProjectWorkbench | null = null;
  private panel: PanelGamePreview | null = null;
  private textureProjectSourceLoader: TextureProjectSourceLoader | null = null;

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
        expectedProjectProvider: () => this.workbenchEnsure().expectedProjectIdentifierRead(),
      });
    }
    return this.service;
  }

  /**
   * Returns the project workbench, creating it on first use.
   *
   * @returns The shared workbench.
   */
  workbenchEnsure(): ProjectWorkbench {
    if (!this.workbench) {
      this.workbench = new ProjectWorkbench({
        control: gameProcessControlResolve(),
        link: new ProjectWorkbenchLinkPreview(this.serviceEnsure()),
        worldGroup: this.hosts.worldGroup,
        recentStore: new ProjectRecentStore(),
        levelBuilder: this.levelBuilderCreate(),
      });
      this.textureProjectSourceLoader = this.textureProjectSourceLoaderCreate(this.workbench);
    }
    return this.workbench;
  }

  /**
   * Returns the loader of the open project's textures.
   *
   * @returns Loader, or null before the workbench exists.
   */
  textureProjectSourceLoaderRead(): TextureProjectSourceLoader | null {
    return this.textureProjectSourceLoader;
  }

  /**
   * Creates the loader that fills the texture browser with the open project's
   * textures.
   *
   * @param workbench Workbench whose open project is followed.
   * @returns Project texture loader.
   */
  private textureProjectSourceLoaderCreate(workbench: ProjectWorkbench): TextureProjectSourceLoader {
    return new TextureProjectSourceLoader({
      workbench,
      control: gameProcessControlResolve(),
      sink: {
        applyEntries: (sourceName, entries) => this.textureSourceApply(sourceName, entries),
        clearSource: (sourceName) => this.textureSourceClear(sourceName),
      },
      statusReport: (message) => this.hosts.statusMessageShow(message),
    });
  }

  /**
   * Creates the Build Level controller over the editor world.
   *
   * @returns Level build controller.
   */
  private levelBuilderCreate(): ControllerLevelBuild {
    const glbExporter = new GlbExporter();
    return new ControllerLevelBuild({
      worldGroup: this.hosts.worldGroup,
      gameProcessControlRead: () => gameProcessControlResolve(),
      levelNameRead: () => this.levelNameRead(),
      glbExport: (worldGroup) => glbExporter.exportForLevelPackage(worldGroup),
    });
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
    this.textureSourceApply(TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS, catalog.entries);
    this.hosts.statusMessageShow(catalog.error !== '' ? catalog.error : `Game materials: ${catalog.entries.length}`);
  }

  /**
   * Shows the entries of one texture source in the texture browser and points
   * existing materials using one of their ids at the new maps. Without a
   * texture browser the entries are released.
   *
   * @param sourceName Name of the texture library source.
   * @param entries Entries of the source.
   */
  private textureSourceApply(sourceName: string, entries: TextureBrowserEntry[]): void {
    const controller = this.hosts.textureBrowserControllerRead();
    if (!controller) {
      entries.forEach((entry) => revokeTextureBrowserEntry(entry));
      return;
    }
    controller.applyEntries(sourceName, entries);
    this.materialsRebind(entries.map((entry) => entry.id));
  }

  /**
   * Removes one texture source from the texture browser and points materials
   * that used its ids at whatever the library resolves now.
   *
   * @param sourceName Name of the texture library source.
   */
  private textureSourceClear(sourceName: string): void {
    const controller = this.hosts.textureBrowserControllerRead();
    if (!controller) {
      return;
    }
    const removedIdentifiers = controller
      .getLibrary()
      .getEntries()
      .filter((entry) => entry.sourceName === sourceName)
      .map((entry) => entry.id);
    controller.clearSource(sourceName);
    this.materialsRebind(removedIdentifiers);
  }

  /**
   * Points content materials using one of the ids at the maps the texture cache
   * resolves now.
   *
   * @param identifiers Texture ids whose materials are refreshed.
   */
  private materialsRebind(identifiers: readonly string[]): void {
    if (identifiers.length > 0) {
      previewCatalogMaterialsRebind(this.hosts.worldGroup, new Set(identifiers), getTextureMapCache());
    }
  }

  /**
   * Returns the panel, creating it on first use.
   *
   * @returns The floating panel.
   */
  private panelEnsure(): PanelGamePreview {
    if (!this.panel) {
      this.panel = new PanelGamePreview(this.hosts.panelHost, this.serviceEnsure(), this.workbenchEnsure());
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
