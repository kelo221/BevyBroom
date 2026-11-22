import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import type { GameProcessLevelTarget } from '@/project/process/game_process_types.js';
import type {
  GameProcessCommandStartResult,
  RunConfiguration,
  RunConfigurationCommandSection,
  RunConfigurationsWriteResult,
} from '@/project/run_configuration/model/run_configuration_types.js';

/** Requests the editor page sends to run commands and store run configurations. */
export interface RunConfigurationRpcHandlers {
  gameProcessCommandStart: (params: {
    command: RunConfigurationCommandSection;
    level?: GameProcessLevelTarget | null;
  }) => GameProcessCommandStartResult;
  runConfigurationsWrite: (params: { configurations: RunConfiguration[] }) => RunConfigurationsWriteResult;
}

/**
 * Creates the request handlers of run configurations, bound to the game host.
 *
 * @param host Game host of the open project.
 * @returns Handlers by request name.
 */
export function runConfigurationRpcHandlersCreate(host: GameProcessHost): RunConfigurationRpcHandlers {
  return {
    gameProcessCommandStart: ({ command, level }) => host.commandStart(command, level ?? null),
    runConfigurationsWrite: ({ configurations }) => host.runConfigurationsWrite(configurations),
  };
}
