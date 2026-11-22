import type * as THREE from 'three';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import type {
  GameProcessAction,
  GameProcessLevelTarget,
  GameProcessStatus,
  ProjectOpenResult,
} from '@/project/process/game_process_types.js';
import type { ProjectLevelOpen } from '@/project/level/project_level_open.js';
import { projectWorkbenchLaunchLevelTextBuild } from '@/project/workbench/project_workbench_launch_level_text.js';
import type { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { documentProjectLinkRead, documentProjectLinkWrite } from '@/project/document/document_project_link.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';
import { ProjectWorkbenchConsoleReporter } from '@/project/workbench/project_workbench_console_reporter.js';
import type { ControllerLevelBuild, LevelBuildResult } from '@/level_build/controller_level_build.js';
import { levelBuildConsoleReport } from '@/level_build/level_build_console_report.js';
import { gameProcessStatusEmptyCreate } from '@/project/process/game_process_status_empty.js';
import { ProjectRunConfigurations } from '@/project/run_configuration/service/project_run_configurations.js';
import type {
  GameProcessCommandStartResult,
  RunConfiguration,
  RunConfigurationCommandSection,
  RunConfigurationsWriteResult,
} from '@/project/run_configuration/model/run_configuration_types.js';

/** Interval between status reads of the managed game. */
export const PROJECT_WORKBENCH_POLL_MILLISECONDS = 500;

/** The parts of the game preview link the workbench drives. */
export interface ProjectWorkbenchLink {
  /** Remembers the endpoint the next connect uses. */
  endpointWrite(endpoint: string): void;
  /** Connects to the remembered endpoint. */
  connect(): void;
  /** Returns true while the link is connected or trying to connect. */
  isLinkActive(): boolean;
}

/** Collaborators of a project workbench. */
export interface ProjectWorkbenchHosts {
  /** Opens projects and manages the game process. */
  control: GameProcessControl;
  /** Game preview link. */
  link: ProjectWorkbenchLink;
  /** Editor world root holding the document's project link. */
  worldGroup: THREE.Object3D;
  /** Recently opened projects. */
  recentStore: ProjectRecentStore;
  /** Writes status changes to the console; defaults to the shared log. */
  consoleReporter?: ProjectWorkbenchConsoleReporter;
  /** Builds level packages into the open project; Build Level fails without it. */
  levelBuilder?: ControllerLevelBuild;
  /** Returns the project level the scene belongs to, or null; none by default. */
  openLevelRead?: () => ProjectLevelOpen | null;
  /**
   * Writes the scene into the open project level; resolves to why nothing was
   * written, or null. Levels are not saved before a start without it.
   */
  openLevelSave?: () => Promise<string | null>;
}

/**
 * Opens game projects, links documents to them, starts, rebuilds, restarts and
 * stops the game, and keeps the newest status for the editor.
 */
export class ProjectWorkbench {
  private readonly hosts: ProjectWorkbenchHosts;
  private readonly consoleReporter: ProjectWorkbenchConsoleReporter;
  private readonly changeListeners = new Set<() => void>();
  private status: GameProcessStatus | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private projectOpenCount = 0;
  private runConfigurations: ProjectRunConfigurations | null = null;

  /**
   * Creates a workbench without an open project.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: ProjectWorkbenchHosts) {
    this.hosts = hosts;
    this.consoleReporter = hosts.consoleReporter ?? new ProjectWorkbenchConsoleReporter();
  }

  /**
   * Returns true when this editor can open projects and manage games.
   *
   * @returns Availability of process control.
   */
  isAvailable(): boolean {
    return this.hosts.control.isAvailable;
  }

  /**
   * Builds the open document into a level package of the open project and
   * reports the outcome in the console.
   *
   * @param levelName Level name; the scene-derived name when omitted.
   * @returns Where the package went, or why nothing was written.
   */
  async levelBuild(levelName?: string): Promise<LevelBuildResult> {
    const result = this.hosts.levelBuilder
      ? await this.hosts.levelBuilder.build(levelName)
      : { ok: false as const, message: 'Build Level is not available in this editor.', problems: [] };
    levelBuildConsoleReport(result);
    return result;
  }

  /**
   * Returns the recently opened project files, newest first.
   *
   * @returns Project file paths.
   */
  recentProjectFilesRead(): readonly string[] {
    return this.hosts.recentStore.listRead();
  }

  /**
   * Opens a project, asking for its file when none is given.
   *
   * @param projectFile Path of broom.project.json, or null to ask the user.
   * @returns Result of opening; a cancelled choice fails with an empty message.
   */
  async projectOpen(projectFile: string | null): Promise<ProjectOpenResult> {
    const chosenFile = projectFile ?? (await this.hosts.control.projectChooseFile());
    if (chosenFile === null) {
      return { ok: false, message: '' };
    }
    const result = await this.hosts.control.projectOpen(chosenFile);
    if (!result.ok) {
      this.hosts.recentStore.forget(chosenFile);
      return result;
    }
    this.hosts.recentStore.remember(chosenFile);
    this.projectAdopt(result.status);
    return result;
  }

  /**
   * Starts an action on the managed game and connects the link after a start.
   * When the game starts in the open level, the level is saved first, and built
   * when the game reads its package; a failed save or build stops the start.
   *
   * @param action Action to start.
   * @returns Status right after the action was scheduled, or the status with
   *   the reason the level did not build.
   */
  async actionRun(action: GameProcessAction): Promise<GameProcessStatus> {
    const level = this.launchLevelTargetRead(action);
    const prepareRefusal = level === null ? null : await this.launchLevelPrepare(level);
    if (prepareRefusal !== null) {
      return this.statusMessageAccept(prepareRefusal);
    }
    return this.actionStartWithoutPrepare(action);
  }

  /**
   * Returns the run configurations of the open project, creating their service
   * on first use.
   *
   * @returns Run configurations.
   */
  runConfigurationsRead(): ProjectRunConfigurations {
    this.runConfigurations ??= new ProjectRunConfigurations({ workbench: this });
    return this.runConfigurations;
  }

  /**
   * Starts an action in the open level as it is on disk, without saving or
   * building the level first, and connects the preview when the game starts.
   *
   * @param action Action to run.
   * @returns Status right after scheduling.
   */
  async actionStartWithoutPrepare(action: GameProcessAction): Promise<GameProcessStatus> {
    const status = await this.hosts.control.actionStart(action, this.launchLevelTargetRead(action));
    this.statusAccept(status);
    if (action !== 'stop' && !this.hosts.link.isLinkActive()) {
      this.hosts.link.connect();
    }
    return status;
  }

  /**
   * Returns the level of the open project that is open in the editor, whether
   * or not the game starts in it.
   *
   * @returns Open project level, or null when the scene is no level of the open
   *   project.
   */
  openProjectLevelRead(): ProjectLevelOpen | null {
    const projectFile = this.status?.project?.projectFile ?? null;
    const openLevel = this.hosts.openLevelRead?.() ?? null;
    return openLevel !== null && openLevel.projectFile === projectFile ? openLevel : null;
  }

  /**
   * Saves the open level.
   *
   * @returns Null when it was saved, or why not.
   */
  async openLevelSave(): Promise<string | null> {
    if (this.hosts.openLevelSave === undefined) {
      return 'Saving levels is not available in this editor.';
    }
    return this.hosts.openLevelSave();
  }

  /**
   * Asks the desktop app to run a command to its end, with the open project
   * level for level placeholders.
   *
   * @param command Program, arguments and folder.
   * @returns Identifier of the command, or null with the reason in the status.
   */
  async commandStart(command: RunConfigurationCommandSection): Promise<GameProcessCommandStartResult> {
    const level = this.openProjectLevelRead();
    const target = level === null ? null : { levelId: level.id, levelDocument: level.document };
    const result = await this.hosts.control.commandStart(command, target);
    this.statusAccept(result.status);
    return result;
  }

  /**
   * Stores run configurations in the open project's file.
   *
   * @param configurations Configurations to store.
   * @returns The stored configurations, or why they were not stored.
   */
  async runConfigurationsWrite(configurations: RunConfiguration[]): Promise<RunConfigurationsWriteResult> {
    const result = await this.hosts.control.runConfigurationsWrite(configurations);
    if (result.ok) {
      await this.statusRefresh();
    }
    return result;
  }

  /**
   * Plays the open level in the game at once: starts the game, or builds and
   * starts it again when it already runs, so it shows the scene as it is now.
   *
   * @returns Status right after the action was scheduled.
   */
  async levelPlay(): Promise<GameProcessStatus> {
    return this.actionRun(this.levelPlayActionResolve());
  }

  /**
   * Returns the action that plays the open level: a start when no game runs,
   * otherwise a rebuild, or a restart when the game cannot be built.
   *
   * @returns Action to run.
   */
  levelPlayActionResolve(): GameProcessAction {
    const phase = this.status?.phase ?? 'idle';
    const isGameActive = phase === 'running' || phase === 'starting' || phase === 'building';
    if (!isGameActive) {
      return 'launch';
    }
    return this.status?.project?.canBuild === true ? 'rebuild' : 'restart';
  }

  /**
   * Returns the project level the game starts in, when the open project's game
   * starts in the open level.
   *
   * @returns Open level of the open project, or null when the game takes no
   *   level or no level of the open project is open.
   */
  launchLevelRead(): ProjectLevelOpen | null {
    const project = this.status?.project ?? null;
    if (project === null || !project.isLevelLaunch) {
      return null;
    }
    const openLevel = this.hosts.openLevelRead?.() ?? null;
    return openLevel !== null && openLevel.projectFile === project.projectFile ? openLevel : null;
  }

  /**
   * Describes which level the game starts in.
   *
   * @returns Text for the user, or null when the game takes no level.
   */
  launchLevelTextRead(): string | null {
    return projectWorkbenchLaunchLevelTextBuild(this.status, this.launchLevelRead());
  }

  /**
   * Returns the level an action starts the game in.
   *
   * @param action Action to start.
   * @returns Level target, or null for a stop or a game that takes no level.
   */
  private launchLevelTargetRead(action: GameProcessAction): GameProcessLevelTarget | null {
    const openLevel = action === 'stop' ? null : this.launchLevelRead();
    return openLevel === null ? null : { levelId: openLevel.id, levelDocument: openLevel.document };
  }

  /**
   * Saves the level the game is about to start in, and builds it when the game
   * reads its package.
   *
   * @param level Level the game starts in.
   * @returns Why the start stopped, or null when the level is ready.
   */
  private async launchLevelPrepare(level: GameProcessLevelTarget): Promise<string | null> {
    const saveRefusal = (await this.hosts.openLevelSave?.()) ?? null;
    if (saveRefusal !== null) {
      return `The game was not started: level ${level.levelId} was not saved. ${saveRefusal}`;
    }
    if (this.status?.project?.isLevelExportLaunch !== true) {
      return null;
    }
    const result = await this.levelBuild(level.levelId);
    return result.ok ? null : `The game was not started: level ${level.levelId} did not build. ${result.message}`;
  }

  /**
   * Keeps the newest status with another message and reports the change.
   *
   * @param message What happened, for the user.
   * @returns Status holding the message.
   */
  private statusMessageAccept(message: string): GameProcessStatus {
    const status = { ...(this.status ?? gameProcessStatusEmptyCreate('')), message };
    this.status = status;
    this.changeNotify();
    return status;
  }

  /**
   * Reads the managed game's status now.
   *
   * @returns Newest status.
   */
  async statusRefresh(): Promise<GameProcessStatus> {
    const status = await this.hosts.control.statusRead();
    this.statusAccept(status);
    return status;
  }

  /**
   * Returns the newest status known.
   *
   * @returns Status, or null before a project was opened.
   */
  statusRead(): GameProcessStatus | null {
    return this.status;
  }

  /**
   * Returns how many times a project was opened, so callers can tell a fresh
   * open of the same project file apart.
   *
   * @returns Number of successful opens.
   */
  projectOpenCountRead(): number {
    return this.projectOpenCount;
  }

  /**
   * Returns the project the connected game must belong to: the document's
   * project, else the open project.
   *
   * @returns Project id, or null to accept any game.
   */
  expectedProjectIdentifierRead(): string | null {
    return documentProjectLinkRead(this.hosts.worldGroup) ?? this.status?.project?.projectIdentifier ?? null;
  }

  /**
   * Returns true when the document belongs to a project other than the open
   * one.
   *
   * @returns Whether the document and the open project disagree.
   */
  isDocumentLinkedElsewhere(): boolean {
    const documentProject = documentProjectLinkRead(this.hosts.worldGroup);
    const openProject = this.status?.project?.projectIdentifier ?? null;
    return documentProject !== null && openProject !== null && documentProject !== openProject;
  }

  /** Links the document to the open project, replacing any previous link. */
  documentRelink(): void {
    const openProject = this.status?.project?.projectIdentifier;
    if (openProject !== undefined) {
      documentProjectLinkWrite(this.hosts.worldGroup, openProject);
      this.linkRestartWhenActive();
      this.changeNotify();
    }
  }

  /**
   * Registers a callback run whenever the status or link changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /** Stops reading the game status. */
  dispose(): void {
    this.pollStop();
    this.changeListeners.clear();
  }

  /**
   * Adopts a newly opened project: links an unlinked document, points the
   * preview link at the project's game and starts reading the status.
   *
   * @param status Status right after the project opened.
   */
  private projectAdopt(status: GameProcessStatus): void {
    const project = status.project;
    if (project !== null && documentProjectLinkRead(this.hosts.worldGroup) === null) {
      documentProjectLinkWrite(this.hosts.worldGroup, project.projectIdentifier);
    }
    if (project !== null && project.endpoint !== '') {
      this.hosts.link.endpointWrite(project.endpoint);
    }
    this.projectOpenCount += 1;
    this.statusAccept(status);
    this.linkRestartWhenActive();
    this.pollStart();
  }

  /**
   * Reconnects an active link so it checks the game against the current
   * project.
   */
  private linkRestartWhenActive(): void {
    if (this.hosts.link.isLinkActive()) {
      this.hosts.link.connect();
    }
  }

  /**
   * Keeps a status, reports it and publishes its problems.
   *
   * @param status Newest status.
   */
  private statusAccept(status: GameProcessStatus): void {
    this.status = status;
    this.consoleReporter.report(status);
    ProjectIssueBoard.publish({
      diagnostics: [...status.diagnostics, ...status.gameNotices],
      problems: status.project?.problems ?? [],
    });
    this.changeNotify();
  }

  /** Starts reading the status at a fixed interval. */
  private pollStart(): void {
    this.pollStop();
    this.pollTimer = setInterval(() => {
      void this.statusRefresh().catch(() => undefined);
    }, PROJECT_WORKBENCH_POLL_MILLISECONDS);
  }

  /** Stops reading the status. */
  private pollStop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Runs every change listener. */
  private changeNotify(): void {
    this.changeListeners.forEach((listener) => listener());
  }
}
