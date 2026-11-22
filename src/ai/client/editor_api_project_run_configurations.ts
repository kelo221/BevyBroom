import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';
import { RunConfigurationParser } from '@/project/run_configuration/model/run_configuration_parser.js';
import type { ProjectRunConfigurations } from '@/project/run_configuration/service/project_run_configurations.js';
import { RunConfigurationStepKindRegistry } from '@/project/run_configuration/steps/run_configuration_step_kind_registry.js';

/** Names of the run configuration tools. */
export const EDITOR_API_PROJECT_RUN_CONFIGURATION_TOOL_NAMES: readonly string[] = Object.freeze([
  'list_run_configurations',
  'set_run_configurations',
  'run_configuration',
]);

/** Lists, stores and runs the run configurations of the open project. */
export class EditorApiProjectRunConfigurations {
  private readonly host: EditorApiHost;

  /**
   * Creates the tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs a run configuration tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Pending result, or null when the name is no run configuration
   *   tool.
   */
  runConfigurationToolDispatchAsync(name: string, args: Record<string, unknown>): Promise<McpToolResult> | null {
    if (!EDITOR_API_PROJECT_RUN_CONFIGURATION_TOOL_NAMES.includes(name)) {
      return null;
    }
    const runConfigurations = this.runConfigurationsRead();
    if (runConfigurations === null) {
      return Promise.resolve(failResult(GAME_PROCESS_DESKTOP_ONLY_MESSAGE));
    }
    if (name === 'list_run_configurations') {
      return Promise.resolve(this.listResult(runConfigurations));
    }
    return name === 'set_run_configurations'
      ? this.listWrite(runConfigurations, args)
      : Promise.resolve(this.runStart(runConfigurations, args));
  }

  /**
   * Describes the configurations, the active one, the step kinds and the last
   * run.
   *
   * @param runConfigurations Run configurations of the open project.
   * @returns Result.
   */
  private listResult(runConfigurations: ProjectRunConfigurations): McpToolResult {
    const configurations = runConfigurations.listRead();
    return okResult(`${configurations.length} run configuration(s)`, {
      configurations,
      isStoredInProject: runConfigurations.isStoredInProject(),
      activeId: runConfigurations.activeRead()?.id ?? null,
      stepKinds: RunConfigurationStepKindRegistry.list().map((kind) => ({
        id: kind.id,
        label: kind.label,
        fields: kind.fieldsDescribe(),
      })),
      runState: runConfigurations.runStateRead(),
    });
  }

  /**
   * Stores configurations and picks the active one.
   *
   * @param runConfigurations Run configurations of the open project.
   * @param args Tool arguments with configurations and optional activeId.
   * @returns Result with the stored configurations.
   */
  private async listWrite(
    runConfigurations: ProjectRunConfigurations,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    let configurations;
    try {
      configurations = RunConfigurationParser.listRead(args['configurations']);
    } catch (error) {
      return failResult(error instanceof Error ? error.message : String(error));
    }
    const result = await runConfigurations.listWrite(configurations);
    if (!result.ok) {
      return failResult(result.message);
    }
    if (typeof args['activeId'] === 'string') {
      runConfigurations.activeWrite(args['activeId']);
    }
    return this.listResult(runConfigurations);
  }

  /**
   * Starts a run without waiting for its end.
   *
   * @param runConfigurations Run configurations of the open project.
   * @param args Tool arguments with optional configurationId.
   * @returns Result with the run state right after the start.
   */
  private runStart(runConfigurations: ProjectRunConfigurations, args: Record<string, unknown>): McpToolResult {
    const requested = args['configurationId'];
    const configurationId = typeof requested === 'string' ? requested : (runConfigurations.activeRead()?.id ?? '');
    void runConfigurations.run(configurationId);
    const runState = runConfigurations.runStateRead();
    return okResult(runState?.message ?? `Started ${configurationId}.`, { runState });
  }

  /**
   * Returns the run configurations when this editor can manage games.
   *
   * @returns Run configurations, or null in an editor without process control.
   */
  private runConfigurationsRead(): ProjectRunConfigurations | null {
    const workbench = this.host.projectWorkbenchEnsure?.() ?? null;
    return workbench !== null && workbench.isAvailable() ? workbench.runConfigurationsRead() : null;
  }
}
