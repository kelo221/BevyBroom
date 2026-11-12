import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import {
  createTextureBrowserEntry,
  revokeTextureBrowserEntry,
  type TextureBrowserEntry,
} from '@/texture/library/texture_browser_entry.js';
import { imageFileMimeType } from '@/texture/library/image_file_filter.js';
import { TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES } from '@/texture/library/texture_library_source.js';
import { base64ToBytes } from '@/utils/utils_base64.js';

/** Receives the textures of the open project. */
export interface TextureProjectSourceSink {
  /**
   * Replaces the textures of a library source.
   *
   * @param sourceName Name of the texture library source.
   * @param entries New entries of the source.
   */
  applyEntries(sourceName: string, entries: TextureBrowserEntry[]): void;
  /**
   * Removes every texture of a library source.
   *
   * @param sourceName Name of the texture library source.
   */
  clearSource(sourceName: string): void;
}

/** The parts of the project workbench the loader follows. */
export type TextureProjectSourceWorkbench = ProjectAssetFollowerWorkbench;

/** Collaborators of the project texture loader. */
export interface TextureProjectSourceLoaderHosts {
  /** Workbench whose open project is followed. */
  workbench: TextureProjectSourceWorkbench;
  /** Lists and reads the project's images. */
  control: GameProcessControl;
  /** Receives the loaded textures. */
  sink: TextureProjectSourceSink;
  /** Shows a short message about the result. */
  statusReport: (message: string) => void;
}

/**
 * Loads the images of the open project's texture directories into the 'Project
 * textures' library source whenever a project is opened, and clears the source
 * when the project goes away.
 */
export class TextureProjectSourceLoader extends ProjectAssetFollower {
  private readonly hosts: TextureProjectSourceLoaderHosts;

  /**
   * Creates the loader and starts following the workbench.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: TextureProjectSourceLoaderHosts) {
    super(hosts.workbench);
    this.hosts = hosts;
    this.followStart();
  }

  /** Removes the project textures from the library. */
  protected assetsClear(): void {
    this.hosts.sink.clearSource(TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES);
  }

  /**
   * Shows why the project textures could not be loaded.
   *
   * @param reason Failure message.
   */
  protected loadFailureShow(reason: string): void {
    this.hosts.statusReport(`Project textures: ${reason}`);
  }

  /**
   * Lists and reads the project's images and hands them to the sink unless a
   * newer load started meanwhile.
   *
   * @param generation Load generation the load belongs to.
   */
  protected async assetsLoad(generation: number): Promise<void> {
    const listed = await this.hosts.control.projectTextureList();
    if (!this.isCurrent(generation)) {
      return;
    }
    if (!listed.ok) {
      this.loadFailureShow(listed.message);
      return;
    }
    const entries = await this.entriesRead(listed.texturePaths, generation);
    if (!this.isCurrent(generation)) {
      entries.forEach((entry) => revokeTextureBrowserEntry(entry));
      return;
    }
    this.hosts.sink.applyEntries(TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES, entries);
    this.hosts.statusReport(`Project textures: ${entries.length} of ${listed.texturePaths.length}`);
  }

  /**
   * Reads images one after another, stopping once a newer load started.
   *
   * @param texturePaths Image paths relative to the asset root.
   * @param generation Load generation the reads belong to.
   * @returns Entries of the images that could be read.
   */
  private async entriesRead(texturePaths: readonly string[], generation: number): Promise<TextureBrowserEntry[]> {
    const entries: TextureBrowserEntry[] = [];
    for (const texturePath of texturePaths) {
      if (!this.isCurrent(generation)) {
        break;
      }
      const entry = await this.entryRead(texturePath);
      if (entry !== null) {
        entries.push(entry);
      }
    }
    return entries;
  }

  /**
   * Reads one image into a texture browser entry whose id is its asset path.
   *
   * @param texturePath Image path relative to the asset root.
   * @returns Entry, or null when the image could not be read.
   */
  private async entryRead(texturePath: string): Promise<TextureBrowserEntry | null> {
    const read = await this.hosts.control.projectTextureRead(texturePath);
    if (!read.ok) {
      return null;
    }
    const fileName = texturePath.split('/').pop() ?? texturePath;
    const file = new File([base64ToBytes(read.bytesBase64)], fileName, { type: imageFileMimeType(fileName) });
    return createTextureBrowserEntry(file, texturePath, TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES);
  }
}
