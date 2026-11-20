import type {
  ProjectWorkspaceLast,
  ProjectWorkspaceLastStore,
} from '@/project/workspace/project_workspace_last_store.js';

/** The project side the session reopens and follows. */
export interface ProjectWorkspaceLastProjects {
  /** Whether this editor can open projects at all. */
  isAvailable(): boolean;
  /** Opens a project file and reports whether it opened. */
  projectOpen(projectFile: string): Promise<{ ok: boolean }>;
  /** Path of the open project's file, or null when none is open. */
  projectFileRead(): string | null;
  /** Calls the listener whenever the open project changes. */
  changeListenerAdd(listener: () => void): () => void;
}

/** The level side the session reopens and follows. */
export interface ProjectWorkspaceLastLevels {
  /** Waits until the open project's level list is current. */
  listIdle(): Promise<void>;
  /** Whether the open project lists a level document. */
  isLevelListed(document: string): boolean;
  /** Opens a level of the open project into the scene, without asking. */
  levelOpen(document: string): Promise<{ ok: boolean }>;
  /**
   * Makes a listed level of the open project the open level without loading it,
   * so the scene in the editor is saved into it and played from it.
   */
  levelAdopt(document: string): void;
  /** The open level as its project file and document, or null. */
  openLevelRead(): { projectFile: string; document: string } | null;
  /** Calls the listener whenever the open level or level list changes. */
  changeListenerAdd(listener: () => void): () => void;
}

/** Parts the last-workspace session works with. */
export interface ProjectWorkspaceLastSessionHosts {
  store: ProjectWorkspaceLastStore;
  projects: ProjectWorkspaceLastProjects;
  levels: ProjectWorkspaceLastLevels;
  /**
   * Settles once startup recovery of unsaved work is decided; true when the
   * scene was replaced by recovered work, so the level must not be reopened.
   */
  recoveryDecided: Promise<boolean>;
}

/**
 * Reopens the project and level that were open when the editor was last used,
 * then remembers every project and level opened afterwards.
 */
export class ProjectWorkspaceLastSession {
  private readonly hosts: ProjectWorkspaceLastSessionHosts;
  private readonly listenerRemovers: (() => void)[] = [];
  private isDisposed = false;

  /**
   * Creates the session; nothing happens until it is started.
   *
   * @param hosts Store, projects, levels and the recovery decision.
   */
  constructor(hosts: ProjectWorkspaceLastSessionHosts) {
    this.hosts = hosts;
  }

  /**
   * Reopens the last workspace, then starts remembering changes.
   *
   * @returns Promise settling once reopening finished and remembering began.
   */
  async start(): Promise<void> {
    if (!this.hosts.projects.isAvailable()) {
      return;
    }
    const lastWorkspace = this.hosts.store.read();
    try {
      if (lastWorkspace !== null) {
        await this.workspaceReopen(lastWorkspace);
      }
    } finally {
      this.followStart();
    }
  }

  /** Stops remembering changes. */
  dispose(): void {
    this.isDisposed = true;
    this.listenerRemovers.splice(0).forEach((remove) => remove());
  }

  /**
   * Reopens a project, then its level; when recovered work replaced the scene,
   * the level is only made the open level so the recovered work stays.
   *
   * @param lastWorkspace Project and level to reopen.
   */
  private async workspaceReopen(lastWorkspace: ProjectWorkspaceLast): Promise<void> {
    const opened = await this.hosts.projects.projectOpen(lastWorkspace.projectFile);
    const isSceneRecovered = await this.hosts.recoveryDecided;
    if (!opened.ok || lastWorkspace.levelDocument === null || this.isDisposed) {
      return;
    }
    await this.levelReopen(lastWorkspace.levelDocument, isSceneRecovered);
  }

  /**
   * Opens a level of the open project when the project still lists it, or only
   * adopts it as the open level when recovered work holds the scene.
   *
   * @param document Level document path.
   * @param isSceneRecovered True when recovered work replaced the scene.
   */
  private async levelReopen(document: string, isSceneRecovered: boolean): Promise<void> {
    await this.hosts.levels.listIdle();
    if (this.isDisposed || !this.hosts.levels.isLevelListed(document)) {
      return;
    }
    if (isSceneRecovered) {
      this.hosts.levels.levelAdopt(document);
      return;
    }
    await this.hosts.levels.levelOpen(document);
  }

  /** Remembers the workspace now and after every project or level change. */
  private followStart(): void {
    if (this.isDisposed) {
      return;
    }
    const remember = (): void => this.workspaceRemember();
    this.listenerRemovers.push(this.hosts.projects.changeListenerAdd(remember));
    this.listenerRemovers.push(this.hosts.levels.changeListenerAdd(remember));
    remember();
  }

  /** Writes the open project and its open level to the store. */
  private workspaceRemember(): void {
    const projectFile = this.hosts.projects.projectFileRead();
    if (projectFile === null) {
      return;
    }
    const openLevel = this.hosts.levels.openLevelRead();
    const isLevelOfProject =
      openLevel !== null &&
      ProjectWorkspaceLastSession.pathNormalize(openLevel.projectFile) ===
        ProjectWorkspaceLastSession.pathNormalize(projectFile);
    const levelDocument = isLevelOfProject ? openLevel.document : null;
    this.hosts.store.write({ projectFile, levelDocument });
  }

  /**
   * Returns a path with forward slashes.
   *
   * @param path File path.
   * @returns Normalized path.
   */
  private static pathNormalize(path: string): string {
    return path.replace(/\\/g, '/');
  }
}
