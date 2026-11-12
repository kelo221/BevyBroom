import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';
import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import { projectLevelOpenCreate, type ProjectLevelOpen } from '@/project/level/project_level_open.js';
import type {
  ProjectLevelReadResult,
  ProjectLevelSummary,
  ProjectLevelWriteResult,
} from '@/project/level/project_level_types.js';

/** Message shown while no project is open. */
export const PROJECT_LEVEL_NO_PROJECT_MESSAGE = 'Open a game project to list its levels.';

/** Message returned when Save is asked to write back without an open level. */
export const PROJECT_LEVEL_NONE_OPEN_MESSAGE = 'No project level is open; use Save As New in the Level Browser.';

/** Collaborators of the project level service. */
export interface ProjectLevelServiceHosts {
  /** Workbench whose open project is followed. */
  workbench: ProjectAssetFollowerWorkbench;
  /** Lists, reads and writes the project's level documents. */
  control: GameProcessControl;
}

/** Everything the Level Browser shows about the project's levels. */
export interface ProjectLevelListState {
  /** Levels of the open project, listed ones first. */
  levels: readonly ProjectLevelSummary[];
  /** Absolute document directory, or null while nothing is listed. */
  documentDirectory: string | null;
  /** Why the list is empty, or null when levels can be listed. */
  message: string | null;
  /** True when this editor can reach a project's files. */
  isAvailable: boolean;
}

/**
 * Keeps the levels of the open project listed, remembers which project level
 * the open scene belongs to and reads and writes level documents through the
 * process control. The scene itself is loaded and serialized by its callers.
 */
export class ProjectLevelService extends ProjectAssetFollower {
  private readonly hosts: ProjectLevelServiceHosts;
  private readonly changeListeners = new Set<() => void>();
  private levels: ProjectLevelSummary[] = [];
  private documentDirectory: string | null = null;
  private listMessage: string | null;
  private openLevel: ProjectLevelOpen | null = null;

  /**
   * Creates the service and starts following the workbench.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: ProjectLevelServiceHosts) {
    super(hosts.workbench);
    this.hosts = hosts;
    this.listMessage = this.emptyListMessageRead();
    this.followStart();
  }

  /**
   * Returns the listed levels and why the list may be empty.
   *
   * @returns List state.
   */
  listStateRead(): ProjectLevelListState {
    return {
      levels: this.levels,
      documentDirectory: this.documentDirectory,
      message: this.listMessage,
      isAvailable: this.hosts.control.isAvailable,
    };
  }

  /**
   * Returns the project level the open scene belongs to.
   *
   * @returns Open level, or null when the scene is not a project level.
   */
  openLevelRead(): ProjectLevelOpen | null {
    return this.openLevel;
  }

  /** Forgets the open level, for after New or Load replaced the scene. */
  openLevelForget(): void {
    if (this.openLevel !== null) {
      this.openLevel = null;
      this.changeNotify();
    }
  }

  /**
   * Remembers a level as the one the open scene belongs to.
   *
   * @param level Level that was loaded or written.
   */
  openLevelAdopt(level: ProjectLevelSummary): void {
    const projectFile = this.hosts.workbench.statusRead()?.project?.projectFile ?? '';
    this.openLevel = projectLevelOpenCreate(projectFile, level);
    this.changeNotify();
  }

  /**
   * Finds a listed level by id or document path.
   *
   * @param idOrDocument Level id or document path.
   * @returns The level, or null when none matches.
   */
  levelFind(idOrDocument: string): ProjectLevelSummary | null {
    return (
      this.levels.find((level) => level.id === idOrDocument) ??
      this.levels.find((level) => level.document === idOrDocument) ??
      null
    );
  }

  /**
   * Lists the levels again, keeping the shown list until the new one arrives,
   * and waits for the result.
   *
   * @returns Promise settling once the list is current.
   */
  async refresh(): Promise<void> {
    this.loadAgain();
    await this.idle();
  }

  /**
   * Reads one level document of the open project.
   *
   * @param document Document path relative to the document directory.
   * @returns The level and its text, or why the document is not returned.
   */
  documentRead(document: string): Promise<ProjectLevelReadResult> {
    return this.hosts.control.projectLevelRead(document);
  }

  /**
   * Writes scene text back into the open level.
   *
   * @param text Scene document text.
   * @param isOverwriteForced True to replace a document another program changed
   *   since the editor read it.
   * @returns The level afterwards, or why nothing was written.
   */
  async openLevelWrite(text: string, isOverwriteForced: boolean): Promise<ProjectLevelWriteResult> {
    const openLevel = this.openLevel;
    if (openLevel === null) {
      return { ok: false, message: PROJECT_LEVEL_NONE_OPEN_MESSAGE };
    }
    const result = await this.hosts.control.projectLevelWrite({
      document: openLevel.document,
      text,
      knownModifiedMilliseconds: isOverwriteForced ? null : openLevel.knownModifiedMilliseconds,
    });
    return this.writeResultAdopt(result);
  }

  /**
   * Creates a new level from scene text and makes it the open level.
   *
   * @param name Display name typed by the level designer.
   * @param text Scene document text.
   * @returns The new level, or why nothing was written.
   */
  async levelCreate(name: string, text: string): Promise<ProjectLevelWriteResult> {
    return this.writeResultAdopt(await this.hosts.control.projectLevelCreate({ name, text }));
  }

  /**
   * Renames a level; the open level follows when it is the renamed one.
   *
   * @param document Document path of the level to rename.
   * @param name New display name.
   * @returns The renamed level, or why nothing was moved.
   */
  async levelRename(document: string, name: string): Promise<ProjectLevelWriteResult> {
    const result = await this.hosts.control.projectLevelRename({ document, name });
    if (result.ok && this.openLevel?.document === document) {
      this.openLevelAdopt(result.level);
    }
    await this.refreshWhenOk(result);
    return result;
  }

  /**
   * Registers a callback run whenever the list or the open level changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /** Stops following the workbench and drops the listeners. */
  override dispose(): void {
    super.dispose();
    this.changeListeners.clear();
  }

  /**
   * Empties the list; the open level stays until the project turns out to
   * differ.
   */
  protected assetsClear(): void {
    this.levels = [];
    this.documentDirectory = null;
    this.listMessage = this.emptyListMessageRead();
    this.changeNotify();
  }

  /**
   * Returns why nothing is listed while no project's levels are known.
   *
   * @returns Desktop-only explanation, or the no-project message.
   */
  private emptyListMessageRead(): string {
    return this.hosts.control.isAvailable ? PROJECT_LEVEL_NO_PROJECT_MESSAGE : GAME_PROCESS_DESKTOP_ONLY_MESSAGE;
  }

  /**
   * Keeps the reason the list is empty.
   *
   * @param reason Failure message.
   */
  protected loadFailureShow(reason: string): void {
    this.listMessage = reason;
    this.changeNotify();
  }

  /**
   * Lists the levels of the open project and forgets an open level of another
   * project.
   *
   * @param generation Load generation the load belongs to.
   */
  protected async assetsLoad(generation: number): Promise<void> {
    const listed = await this.hosts.control.projectLevelList();
    if (!this.isCurrent(generation)) {
      return;
    }
    if (!listed.ok) {
      this.loadFailureShow(listed.message);
      return;
    }
    this.levels = listed.levels;
    this.documentDirectory = listed.documentDirectory;
    this.listMessage = null;
    if (this.openLevel !== null && this.openLevel.projectFile !== listed.projectFile) {
      this.openLevel = null;
    }
    this.changeNotify();
  }

  /**
   * Makes a written level the open level and lists the levels again.
   *
   * @param result Outcome of a write or create.
   * @returns The same outcome.
   */
  private async writeResultAdopt(result: ProjectLevelWriteResult): Promise<ProjectLevelWriteResult> {
    if (result.ok) {
      this.openLevelAdopt(result.level);
    }
    await this.refreshWhenOk(result);
    return result;
  }

  /**
   * Lists the levels again after a write that succeeded.
   *
   * @param result Outcome of a write.
   */
  private async refreshWhenOk(result: ProjectLevelWriteResult): Promise<void> {
    if (result.ok) {
      await this.refresh();
    }
  }

  /** Runs every change listener. */
  private changeNotify(): void {
    this.changeListeners.forEach((listener) => listener());
  }
}
