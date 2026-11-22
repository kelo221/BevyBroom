import type { GameProcessStatus } from '@/project/process/game_process_types.js';

/** Key of the run configuration list in broom.project.json. */
export const RUN_CONFIGURATIONS_PROJECT_KEY = 'run_configurations';

/** Value of one step field: a text or a list of texts such as arguments. */
export type RunConfigurationFieldValue = string | string[];

/**
 * One step of a run configuration, such as saving the level or running a
 * command.
 */
export interface RunConfigurationStep {
  /** Identifier of the step kind that runs the step. */
  kind: string;
  /** False for steps the configuration keeps but skips. */
  enabled: boolean;
  /** Fields the step kind reads, by field key. */
  fields: Record<string, RunConfigurationFieldValue>;
}

/** Named list of steps run one after another, such as "Play" or "Bake Lighting". */
export interface RunConfiguration {
  /** Stable identifier, unique in the project. */
  id: string;
  /** Name shown in the Run menu. */
  name: string;
  /** Steps in the order they run. */
  steps: RunConfigurationStep[];
}

/** Command a step asks the desktop app to run to its end. */
export interface RunConfigurationCommandSection {
  /** Program to start. */
  program: string;
  /** Arguments, each one entry; placeholders such as {level_id} are replaced. */
  arguments: string[];
  /** Folder the program runs in, relative to the project folder. */
  working_directory: string;
}

/** State of the last command a run configuration asked the desktop app to run. */
export interface GameProcessCommandStatus {
  /** Identifier the desktop app gave the command when it was scheduled. */
  identifier: number;
  /** Where the command is. */
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  /** Exit code once it ended, or null before. */
  exitCode: number | null;
}

/** Answer of the desktop app to a command a run configuration asked for. */
export interface GameProcessCommandStartResult {
  /** Identifier of the scheduled command, or null when it was refused. */
  identifier: number | null;
  /** Status right after scheduling; its message says why a command was refused. */
  status: GameProcessStatus;
}

/** Outcome of saving the run configurations into the project file. */
export type RunConfigurationsWriteResult =
  { ok: true; configurations: RunConfiguration[] } | { ok: false; message: string };
