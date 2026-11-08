import type { GameProcessControl } from '@/project/control/game_process_control.js';
import type { GameProcessStatus } from '@/project/process/game_process_types.js';
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
export interface TextureProjectSourceWorkbench {
  /**
   * Registers a callback run whenever the project status changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void;
  /**
   * Returns the newest status.
   *
   * @returns Status, or null before a project was opened.
   */
  statusRead(): GameProcessStatus | null;
  /**
   * Returns how many times a project was opened.
   *
   * @returns Number of successful opens.
   */
  projectOpenCountRead(): number;
}

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
 * when the project goes away. Results of a load overtaken by a newer project
 * are dropped.
 */
export class TextureProjectSourceLoader {
  private readonly hosts: TextureProjectSourceLoaderHosts;
  private readonly listenerRemove: () => void;
  private shownProjectKey: string | null = null;
  private loadGeneration = 0;
  private pendingLoad: Promise<void> = Promise.resolve();

  /**
   * Creates the loader and starts following the workbench.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: TextureProjectSourceLoaderHosts) {
    this.hosts = hosts;
    this.listenerRemove = hosts.workbench.changeListenerAdd(() => this.projectChangeHandle());
    this.projectChangeHandle();
  }

  /**
   * Waits for the newest load to finish.
   *
   * @returns Promise that settles once the newest load is done.
   */
  idle(): Promise<void> {
    return this.pendingLoad;
  }

  /** Stops following the workbench and clears the project textures. */
  dispose(): void {
    this.listenerRemove();
    this.loadGeneration += 1;
    this.shownProjectKey = null;
    this.hosts.sink.clearSource(TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES);
  }

  /** Starts a new load when the open project differs from the shown one. */
  private projectChangeHandle(): void {
    const projectKey = this.projectKeyRead();
    if (projectKey === this.shownProjectKey) {
      return;
    }
    this.shownProjectKey = projectKey;
    this.loadGeneration += 1;
    this.hosts.sink.clearSource(TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES);
    if (projectKey !== null) {
      this.pendingLoad = this.loadRun(this.loadGeneration);
    }
  }

  /**
   * Builds the key of the open project: its file and the open count.
   *
   * @returns Key, or null when no project is open.
   */
  private projectKeyRead(): string | null {
    const project = this.hosts.workbench.statusRead()?.project ?? null;
    return project === null ? null : `${this.hosts.workbench.projectOpenCountRead()}:${project.projectFile}`;
  }

  /**
   * Runs one load and reports failures instead of throwing.
   *
   * @param generation Load generation the load belongs to.
   */
  private async loadRun(generation: number): Promise<void> {
    try {
      await this.load(generation);
    } catch (error) {
      if (this.isCurrent(generation)) {
        this.hosts.statusReport(`Project textures: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Lists and reads the project's images and hands them to the sink unless a
   * newer load started meanwhile.
   *
   * @param generation Load generation the load belongs to.
   */
  private async load(generation: number): Promise<void> {
    const listed = await this.hosts.control.projectTextureList();
    if (!this.isCurrent(generation)) {
      return;
    }
    if (!listed.ok) {
      this.hosts.statusReport(`Project textures: ${listed.message}`);
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

  /**
   * Returns whether a load is still the newest one.
   *
   * @param generation Load generation to check.
   * @returns True while no newer load started.
   */
  private isCurrent(generation: number): boolean {
    return generation === this.loadGeneration;
  }
}
