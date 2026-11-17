import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import type { ProjectDataFile, ProjectDataFileChangeResult } from '@/project/data/project_data_file_types.js';
import type { PrefabCatalogPersistence, PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';
import { PrefabFileCodec } from '@/prefab/payload/prefab_file_codec.js';

/** Collaborators of the project prefab library. */
export interface PrefabProjectLibraryHosts {
  /** Workbench whose open project is followed. */
  workbench: ProjectAssetFollowerWorkbench;
  /** Reads and writes the project's prefab files. */
  control: GameProcessControl;
  /** Catalog showing the prefabs. */
  store: PrefabCatalogStore;
  /**
   * Target whose focus reloads the files, such as the editor window; none when
   * null.
   */
  focusTarget: EventTarget | null;
  /** Returns the console receiving load and write problems. */
  consoleLog: () => ConsoleLog;
}

/**
 * Keeps the prefabs of the open project's prefab directory in the catalog:
 * loads one file per prefab whenever a project opens or the editor window gains
 * focus, and saves or deletes the file of every prefab created or deleted while
 * the project is open.
 */
export class PrefabProjectLibrary extends ProjectAssetFollower implements PrefabCatalogPersistence {
  private readonly hosts: PrefabProjectLibraryHosts;
  private shownFilesKey: string | null = null;
  private pendingWrites: Promise<unknown> = Promise.resolve();

  /**
   * Creates the library and loads the open project.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: PrefabProjectLibraryHosts) {
    super(hosts.workbench);
    this.hosts = hosts;
    this.followStart();
    if (hosts.focusTarget !== null) {
      this.focusReloadFollow(hosts.focusTarget);
    }
  }

  /**
   * Waits until every load and every file write started so far finished.
   *
   * @returns Promise that settles once idle.
   */
  override async idle(): Promise<void> {
    await super.idle();
    await this.pendingWrites;
  }

  /**
   * Writes the file of a prefab.
   *
   * @param template Prefab to save.
   */
  templateSave(template: PrefabTemplate): void {
    const name = PrefabFileCodec.fileNameFromId(template.id);
    const text = PrefabFileCodec.textWrite(template);
    this.writeTrack(this.hosts.control.projectDataFileWrite({ kind: 'prefabs', name, text }), `save ${name}`);
  }

  /**
   * Deletes the file of a prefab.
   *
   * @param template Removed prefab.
   */
  templateDelete(template: PrefabTemplate): void {
    const name = PrefabFileCodec.fileNameFromId(template.id);
    this.writeTrack(this.hosts.control.projectDataFileRemove({ kind: 'prefabs', name }), `delete ${name}`);
  }

  /** Removes the project's prefabs from the catalog and stops saving into it. */
  protected assetsClear(): void {
    this.shownFilesKey = null;
    this.hosts.store.persistenceAttach(null, []);
  }

  /**
   * Reports why the prefab files could not be read.
   *
   * @param reason Failure message.
   */
  protected loadFailureShow(reason: string): void {
    this.hosts.consoleLog().entryAppendError(`Project prefabs: ${reason}`);
  }

  /**
   * Reads the prefab files and shows them unless a newer load started.
   *
   * @param generation Load generation the load belongs to.
   */
  protected async assetsLoad(generation: number): Promise<void> {
    const read = await this.hosts.control.projectDataFilesRead('prefabs');
    if (!this.isCurrent(generation)) {
      return;
    }
    if (!read.ok) {
      throw new Error(read.message);
    }
    if (!read.isConfigured) {
      this.assetsClear();
      return;
    }
    this.filesShow(read.files);
  }

  /**
   * Attaches this library to the catalog with the prefabs of the files, unless
   * the same files are shown already; unreadable files are reported and left
   * out.
   *
   * @param files Prefab files.
   */
  private filesShow(files: readonly ProjectDataFile[]): void {
    const filesKey = JSON.stringify(files);
    if (filesKey === this.shownFilesKey) {
      return;
    }
    this.shownFilesKey = filesKey;
    const templates = files.flatMap((file) => this.fileTemplateRead(file));
    this.hosts.store.persistenceAttach(this, templates);
  }

  /**
   * Reads one prefab file.
   *
   * @param file Prefab file.
   * @returns The prefab, or nothing when the file is not a prefab file.
   */
  private fileTemplateRead(file: ProjectDataFile): PrefabTemplate[] {
    try {
      return [PrefabFileCodec.textRead(file.name, file.text)];
    } catch (error) {
      this.loadFailureShow(error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Remembers a pending file change and reports it when it fails.
   *
   * @param change Pending change.
   * @param description What the change does, used in messages.
   */
  private writeTrack(change: Promise<ProjectDataFileChangeResult>, description: string): void {
    const tracked = change.then((result) => {
      if (!result.ok) {
        this.hosts.consoleLog().entryAppendError(`Could not ${description}: ${result.message}`);
      }
    });
    this.pendingWrites = Promise.all([this.pendingWrites, tracked]);
  }
}
