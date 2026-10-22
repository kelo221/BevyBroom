import type * as THREE from 'three';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import type { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { documentProjectLinkRead, documentProjectLinkWrite } from '@/project/document/document_project_link.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';
import { ProjectWorkbenchConsoleReporter } from '@/project/workbench/project_workbench_console_reporter.js';

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
   *
   * @param action Action to start.
   * @returns Status right after the action was scheduled.
   */
  async actionRun(action: GameProcessAction): Promise<GameProcessStatus> {
    const status = await this.hosts.control.actionStart(action);
    this.statusAccept(status);
    if (action !== 'stop' && !this.hosts.link.isLinkActive()) {
      this.hosts.link.connect();
    }
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
    ProjectIssueBoard.publish({ diagnostics: status.diagnostics, problems: status.project?.problems ?? [] });
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
