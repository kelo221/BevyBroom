import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import type { ProjectLevelWriteResult } from '@/project/level/project_level_types.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';

/** Names of the project level tools. */
export const EDITOR_API_PROJECT_LEVEL_TOOL_NAMES: readonly string[] = Object.freeze([
  'list_project_levels',
  'open_project_level',
  'save_project_level',
]);

/** Lists, opens and saves the level documents of the open game project. */
export class EditorApiProjectLevels {
  private readonly host: EditorApiHost;

  /**
   * Creates the project level tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs a project level tool.
   *
   * @param name Tool name.
   * @param args Argument object.
   * @returns Pending result, or null when the name is not a project level tool.
   */
  levelToolDispatchAsync(name: string, args: Record<string, unknown>): Promise<McpToolResult> | null {
    if (!EDITOR_API_PROJECT_LEVEL_TOOL_NAMES.includes(name)) {
      return null;
    }
    const actions = this.actionsAvailableRead();
    if (actions === null) {
      return Promise.resolve(failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE));
    }
    if (name === 'list_project_levels') {
      return this.levelsList(actions);
    }
    return name === 'open_project_level' ? this.levelOpen(actions, args) : this.levelSave(actions, args);
  }

  /**
   * Returns the level actions when the desktop app can manage project files.
   *
   * @returns Level actions, or null in a browser.
   */
  private actionsAvailableRead(): ProjectLevelActions | null {
    const actions = this.host.projectLevelActionsRead?.() ?? null;
    return actions !== null && actions.serviceRead().listStateRead().isAvailable ? actions : null;
  }

  /**
   * Refreshes and lists the levels of the open project.
   *
   * @param actions Level actions.
   * @returns Result with the levels and the open level.
   */
  private async levelsList(actions: ProjectLevelActions): Promise<McpToolResult> {
    const service = actions.serviceRead();
    await service.refresh();
    const state = service.listStateRead();
    if (state.documentDirectory === null) {
      return failResult(state.message ?? 'Open a game project to list its levels.');
    }
    const projectFile = this.host.projectWorkbenchEnsure?.().statusRead()?.project?.projectFile ?? '';
    return okResult(`${state.levels.length} level(s)`, {
      projectFile,
      documentDirectory: state.documentDirectory,
      levels: [...state.levels],
      openLevel: service.openLevelRead(),
    });
  }

  /**
   * Opens the level named by levelId or document, replacing the open scene.
   *
   * @param actions Level actions.
   * @param args Argument object with levelId or document.
   * @returns Result with the opened level.
   */
  private async levelOpen(actions: ProjectLevelActions, args: Record<string, unknown>): Promise<McpToolResult> {
    const key = this.textArgRead(args, 'levelId') ?? this.textArgRead(args, 'document');
    if (key === null) {
      return failResult('open_project_level needs a levelId or a document path');
    }
    const service = actions.serviceRead();
    await service.refresh();
    const level = service.levelFind(key);
    if (level === null) {
      return failResult(`The open project has no level ${key}; call list_project_levels`);
    }
    const result = await actions.levelOpen(level.document, true);
    return result.ok
      ? okResult(`Opened level ${result.level.name}`, { level: result.level })
      : failResult(result.message);
  }

  /**
   * Saves the open scene: back into the open level, or into a new level when a
   * name is given.
   *
   * @param actions Level actions.
   * @param args Argument object with an optional name.
   * @returns Result with the saved level.
   */
  private async levelSave(actions: ProjectLevelActions, args: Record<string, unknown>): Promise<McpToolResult> {
    const name = this.textArgRead(args, 'name');
    const result = name === null ? await actions.levelSave(false) : await actions.levelSaveAsNew(name);
    return this.writeResultConvert(result);
  }

  /**
   * Turns a level write result into a tool result.
   *
   * @param result Level write result.
   * @returns Tool result with the level, or the refusal.
   */
  private writeResultConvert(result: ProjectLevelWriteResult): McpToolResult {
    if (result.ok) {
      return okResult(`Saved level ${result.level.name}`, { level: result.level });
    }
    return { ok: false, message: result.message, data: { refusal: result.refusal ?? null } };
  }

  /**
   * Reads a non-empty text argument.
   *
   * @param args Argument object.
   * @param key Argument name.
   * @returns Text, or null when missing or empty.
   */
  private textArgRead(args: Record<string, unknown>, key: string): string | null {
    const value = args[key];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }
}
