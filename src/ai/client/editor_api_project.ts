import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { GameProcessAction, GameProcessStatus } from '@/project/process/game_process_types.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';
import { documentProjectLinkRead } from '@/project/document/document_project_link.js';
import { EDITOR_API_PROJECT_LEVEL_TOOL_NAMES, EditorApiProjectLevels } from './editor_api_project_levels.js';
import { EDITOR_API_PROJECT_CLASS_TOOL_NAMES, EditorApiProjectClasses } from './editor_api_project_classes.js';
import { EDITOR_API_PROJECT_PREFAB_TOOL_NAMES, EditorApiProjectPrefabs } from './editor_api_project_prefabs.js';
import {
  EDITOR_API_PROJECT_RUN_CONFIGURATION_TOOL_NAMES,
  EditorApiProjectRunConfigurations,
} from './editor_api_project_run_configurations.js';

/** Game actions by the name of the tool that starts them. */
const EDITOR_API_PROJECT_ACTION_TOOLS: Readonly<Record<string, GameProcessAction>> = {
  game_launch: 'launch',
  game_rebuild: 'rebuild',
  game_restart: 'restart',
  game_stop: 'stop',
};

/** Tool that plays the open level in the game at once. */
const EDITOR_API_PROJECT_LEVEL_PLAY_TOOL = 'game_play_level';

/** Opens game projects and drives the game the editor manages. */
export class EditorApiProject {
  private readonly host: EditorApiHost;
  private readonly levels: EditorApiProjectLevels;
  private readonly classes: EditorApiProjectClasses;
  private readonly prefabs: EditorApiProjectPrefabs;
  private readonly runConfigurations: EditorApiProjectRunConfigurations;

  /**
   * Creates the project tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
    this.levels = new EditorApiProjectLevels(host);
    this.classes = new EditorApiProjectClasses();
    this.prefabs = new EditorApiProjectPrefabs(host);
    this.runConfigurations = new EditorApiProjectRunConfigurations(host);
  }

  /**
   * Runs a project tool.
   *
   * @param name Tool name.
   * @param args Argument object.
   * @returns Pending result, or null when the name is not a project tool.
   */
  projectToolDispatchAsync(name: string, args: Record<string, unknown>): Promise<McpToolResult> | null {
    if (name === 'project_open') {
      return this.projectOpen(args);
    }
    if (name === 'project_status') {
      return this.projectStatus();
    }
    if (name === 'build_level') {
      return this.levelBuild(args);
    }
    if (name === EDITOR_API_PROJECT_LEVEL_PLAY_TOOL) {
      return this.levelPlayRun();
    }
    const groupResult = this.toolGroupDispatchAsync(name, args);
    if (groupResult !== null) {
      return groupResult;
    }
    const action = EDITOR_API_PROJECT_ACTION_TOOLS[name];
    return action === undefined ? null : this.gameActionRun(action);
  }

  /**
   * Runs a tool of the level, class, run configuration or prefab groups.
   *
   * @param name Tool name.
   * @param args Argument object.
   * @returns Pending result, or null when no group has the tool.
   */
  private toolGroupDispatchAsync(name: string, args: Record<string, unknown>): Promise<McpToolResult> | null {
    const groupResult =
      this.levels.levelToolDispatchAsync(name, args) ??
      this.classes.classToolDispatchAsync(name, args) ??
      this.runConfigurations.runConfigurationToolDispatchAsync(name, args);
    if (groupResult !== null) {
      return groupResult;
    }
    const prefabResult = this.prefabs.prefabToolDispatch(name, args);
    return prefabResult === null ? null : Promise.resolve(prefabResult);
  }

  /**
   * Answers a project tool called without waiting, since every project tool
   * waits for the desktop app.
   *
   * @param name Tool name.
   * @returns Failure pointing at the waiting call, or null when the name is not
   *   a project tool.
   */
  projectToolDispatchSync(name: string): McpToolResult | null {
    const isProjectTool =
      name === 'project_open' ||
      name === 'project_status' ||
      name === 'build_level' ||
      name === EDITOR_API_PROJECT_LEVEL_PLAY_TOOL ||
      EDITOR_API_PROJECT_LEVEL_TOOL_NAMES.includes(name) ||
      EDITOR_API_PROJECT_CLASS_TOOL_NAMES.includes(name) ||
      EDITOR_API_PROJECT_PREFAB_TOOL_NAMES.includes(name) ||
      EDITOR_API_PROJECT_RUN_CONFIGURATION_TOOL_NAMES.includes(name) ||
      EDITOR_API_PROJECT_ACTION_TOOLS[name] !== undefined;
    return isProjectTool ? failResult(`${name} waits for the desktop app; call it through invokeToolAsync`) : null;
  }

  /**
   * Opens the project file named by the path argument.
   *
   * @param args Argument object with path.
   * @returns Result with the new status.
   */
  private async projectOpen(args: Record<string, unknown>): Promise<McpToolResult> {
    const workbench = this.workbenchAvailableRead();
    const path = args['path'];
    if (workbench === null) {
      return failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE);
    }
    if (typeof path !== 'string' || path.length === 0) {
      return failResult('project_open needs the path of broom.project.json');
    }
    const result = await workbench.projectOpen(path);
    return result.ok
      ? okResult(result.status.message, this.statusDataBuild(workbench, result.status))
      : failResult(result.message);
  }

  /**
   * Reads the status of the open project and its game.
   *
   * @returns Result with the status.
   */
  private async projectStatus(): Promise<McpToolResult> {
    const workbench = this.host.projectWorkbenchEnsure?.() ?? null;
    if (workbench === null) {
      return failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE);
    }
    const status = await workbench.statusRefresh();
    return okResult(`Game ${status.phase}`, this.statusDataBuild(workbench, status));
  }

  /**
   * Builds the open document into a level package of the open project.
   *
   * @param args Argument object with an optional levelName.
   * @returns Result with where the package went, or the problems that stopped
   *   it.
   */
  private async levelBuild(args: Record<string, unknown>): Promise<McpToolResult> {
    const workbench = this.workbenchAvailableRead();
    if (workbench === null) {
      return failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE);
    }
    const levelName = typeof args['levelName'] === 'string' && args['levelName'] !== '' ? args['levelName'] : undefined;
    const result = await workbench.levelBuild(levelName);
    return result.ok
      ? okResult(`Built level ${result.levelName}`, { ...result })
      : { ok: false, message: result.message, data: { problems: result.problems } };
  }

  /**
   * Starts a game action.
   *
   * @param action Action to start.
   * @returns Result with the status right after the action was scheduled.
   */
  private async gameActionRun(action: GameProcessAction): Promise<McpToolResult> {
    const workbench = this.workbenchAvailableRead();
    if (workbench === null) {
      return failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE);
    }
    const status = await workbench.actionRun(action);
    return okResult(status.message, this.statusDataBuild(workbench, status));
  }

  /**
   * Plays the open level in the game at once.
   *
   * @returns Result with the status right after the action was scheduled.
   */
  private async levelPlayRun(): Promise<McpToolResult> {
    const workbench = this.workbenchAvailableRead();
    if (workbench === null) {
      return failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE);
    }
    const status = await workbench.levelPlay();
    return okResult(status.message, this.statusDataBuild(workbench, status));
  }

  /**
   * Returns the workbench when this editor can manage games.
   *
   * @returns Workbench, or null in an editor without process control.
   */
  private workbenchAvailableRead(): ProjectWorkbench | null {
    const workbench = this.host.projectWorkbenchEnsure?.() ?? null;
    return workbench !== null && workbench.isAvailable() ? workbench : null;
  }

  /**
   * Builds the data returned with a status.
   *
   * @param workbench Project workbench.
   * @param status Status to return.
   * @returns Status with the document and expected project ids and the id of
   *   the level the game starts in (null when it takes none).
   */
  private statusDataBuild(workbench: ProjectWorkbench, status: GameProcessStatus): Record<string, unknown> {
    return {
      ...status,
      canManageGames: workbench.isAvailable(),
      documentProjectId: documentProjectLinkRead(this.host.worldObject),
      expectedProjectId: workbench.expectedProjectIdentifierRead(),
      launchLevelId: workbench.launchLevelRead()?.id ?? null,
    };
  }
}
