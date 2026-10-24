import * as THREE from 'three';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { GameProcessControl } from '@/project/control/game_process_control.js';
import type {
  GameProcessAction,
  GameProcessStatus,
  ProjectOpenResult,
  ProjectSummary,
} from '@/project/process/game_process_types.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { ProjectWorkbench, type ProjectWorkbenchLink } from '@/project/workbench/project_workbench.js';
import { ProjectWorkbenchConsoleReporter } from '@/project/workbench/project_workbench_console_reporter.js';
import { ControllerLevelBuild } from '@/level_build/controller_level_build.js';

/** Process control that opens any file as a project named after it. */
export class GameProcessControlFake extends GameProcessControl {
  readonly isAvailable = true;
  readonly actions: GameProcessAction[] = [];
  chosenFile: string | null = null;
  nextStatus: GameProcessStatus | null = null;
  readonly publishedLevels: LevelBuildPublishRequest[] = [];
  nextPublishResult: LevelBuildPublishResult | null = null;

  /** @inheritdoc */
  async projectChooseFile(): Promise<string | null> {
    return this.chosenFile;
  }

  /** @inheritdoc */
  async projectOpen(projectFile: string): Promise<ProjectOpenResult> {
    if (projectFile.includes('missing')) {
      return { ok: false, message: `Cannot open ${projectFile}` };
    }
    this.nextStatus = gameStatusCreate(projectSummaryCreate(projectFile), 'idle');
    return { ok: true, status: this.nextStatus };
  }

  /** @inheritdoc */
  async actionStart(action: GameProcessAction): Promise<GameProcessStatus> {
    this.actions.push(action);
    return this.statusRead();
  }

  /** @inheritdoc */
  async statusRead(): Promise<GameProcessStatus> {
    return this.nextStatus ?? gameStatusCreate(null, 'idle');
  }

  /** @inheritdoc */
  async levelPackagePublish(request: LevelBuildPublishRequest): Promise<LevelBuildPublishResult> {
    this.publishedLevels.push(request);
    return (
      this.nextPublishResult ?? {
        ok: true,
        levelDirectory: `/levels/${request.levelName}`,
        geometryFile: 'geometry_0000000000000001.glb',
        geometryRevision: 1,
        removedGeometryFiles: [],
      }
    );
  }
}

/**
 * Creates the summary of a project named after its file's folder.
 *
 * @param projectFile Project file path.
 * @returns Project summary.
 */
export function projectSummaryCreate(projectFile: string): ProjectSummary {
  const folder = projectFile.split('/').slice(-2, -1)[0] ?? 'project';
  return {
    projectFile,
    projectIdentifier: `id-${folder}`,
    name: folder,
    endpoint: `http://127.0.0.1:1/${folder}`,
    canBuild: true,
    problems: [],
  };
}

/**
 * Creates a status.
 *
 * @param project Open project.
 * @param phase Phase.
 * @returns Status.
 */
export function gameStatusCreate(project: ProjectSummary | null, phase: GameProcessStatus['phase']): GameProcessStatus {
  return {
    project,
    phase,
    processId: null,
    exitCode: null,
    diagnostics: [],
    logTail: [],
    message: phase,
    generation: 1,
  };
}

/** Link double recording endpoints and connects. */
export class ProjectWorkbenchLinkFake implements ProjectWorkbenchLink {
  readonly endpoints: string[] = [];
  connectCount = 0;
  isActive = false;

  /** @inheritdoc */
  endpointWrite(endpoint: string): void {
    this.endpoints.push(endpoint);
  }

  /** @inheritdoc */
  connect(): void {
    this.connectCount += 1;
    this.isActive = true;
  }

  /** @inheritdoc */
  isLinkActive(): boolean {
    return this.isActive;
  }
}

/**
 * Creates a workbench with fakes and a private console log.
 *
 * @param worldGroup World root holding the document's project link.
 * @returns Workbench and its collaborators.
 */
export function workbenchRigCreate(worldGroup: THREE.Group = new THREE.Group()) {
  const control = new GameProcessControlFake();
  const link = new ProjectWorkbenchLinkFake();
  const recentStore = new ProjectRecentStore(null);
  const consoleLog = new ConsoleLog();
  const consoleReporter = new ProjectWorkbenchConsoleReporter(() => consoleLog);
  const levelBuilder = new ControllerLevelBuild({
    worldGroup,
    gameProcessControlRead: () => control,
    levelNameRead: () => 'rig_level',
    glbExport: async () => new ArrayBuffer(0),
    issuesCollect: () => [],
  });
  const workbench = new ProjectWorkbench({ control, link, worldGroup, recentStore, consoleReporter, levelBuilder });
  return { control, link, worldGroup, recentStore, consoleLog, workbench };
}
