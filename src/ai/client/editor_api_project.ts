import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { GameProcessAction, GameProcessStatus } from '@/project/process/game_process_types.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';
import { documentProjectLinkRead } from '@/project/document/document_project_link.js';

/** Game actions by the name of the tool that starts them. */
const EDITOR_API_PROJECT_ACTION_TOOLS: Readonly<Record<string, GameProcessAction>> = {
  game_launch: 'launch',
  game_rebuild: 'rebuild',
  game_restart: 'restart',
  game_stop: 'stop',
};

/** Opens game projects and drives the game the editor manages. */
export class EditorApiProject {
  private readonly host: EditorApiHost;

  /**
   * Creates the project tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
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
    const action = EDITOR_API_PROJECT_ACTION_TOOLS[name];
    return action === undefined ? null : this.gameActionRun(action);
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
   * @returns Status with the document and expected project ids.
   */
  private statusDataBuild(workbench: ProjectWorkbench, status: GameProcessStatus): Record<string, unknown> {
    return {
      ...status,
      canManageGames: workbench.isAvailable(),
      documentProjectId: documentProjectLinkRead(this.host.worldObject),
      expectedProjectId: workbench.expectedProjectIdentifierRead(),
    };
  }
}
