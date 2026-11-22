import type { ProjectProblem } from '@/project/model/project_definition.js';
import type {
  GameProcessCommandStatus,
  RunConfiguration,
} from '@/project/run_configuration/model/run_configuration_types.js';
import type { ProjectToolTextures } from '@/project/model/project_tool_textures_parser.js';
import type { ProjectBuildDiagnostic } from '@/project/build/project_build_diagnostics_parser.js';

/**
 * Where the game the editor manages stands. A game the editor did not start is
 * never managed, so it never shows up here.
 */
export type GameProcessPhase =
  'idle' | 'building' | 'build_failed' | 'starting' | 'running' | 'exited' | 'stopping' | 'stopped';

/** The open project as the editor shows it. */
export interface ProjectSummary {
  projectFile: string;
  projectIdentifier: string;
  name: string;
  /** Bridge endpoint of the project's game; empty uses the editor default. */
  endpoint: string;
  /** True when the project file names a program that starts the game. */
  canLaunch: boolean;
  /** True when the editor knows how to build the game. */
  canBuild: boolean;
  /**
   * True when the game's arguments name the open level through a placeholder
   * such as `{level_id}`, so starting the game needs an open project level.
   */
  isLevelLaunch: boolean;
  /**
   * True when the game's arguments name the open level's package through
   * `{level_id}` or `{level_export_directory}`, so the level is built before
   * the game starts. A game that names only `{level_document}` reads the saved
   * document and needs no build.
   */
  isLevelExportLaunch: boolean;
  /** Problems found when the project was opened. */
  problems: ProjectProblem[];
  /** Textures the project marks for the level export, such as nodraw. */
  toolTextures: ProjectToolTextures;
  /** Run configurations stored in the project file, in file order. */
  runConfigurations: RunConfiguration[];
}

/** Everything the editor shows about the managed game. */
export interface GameProcessStatus {
  project: ProjectSummary | null;
  phase: GameProcessPhase;
  /** Process id of the managed game, or null when none runs. */
  processId: number | null;
  /** Exit code of the last managed process that ended, or null. */
  exitCode: number | null;
  /** Compiler messages of the last build. */
  diagnostics: ProjectBuildDiagnostic[];
  /**
   * Warnings and errors the running game printed as `warning: …` or `error: …`
   * lines.
   */
  gameNotices: ProjectBuildDiagnostic[];
  /** Newest output lines of builds and the game. */
  logTail: string[];
  /** What happened last, for the user. */
  message: string;
  /** Increases with every action, so callers can tell a newer status apart. */
  generation: number;
  /**
   * True while the desktop app still has scheduled game actions or commands to
   * run.
   */
  isBusy: boolean;
  /**
   * Last command a run configuration asked for, or null when none was asked
   * for.
   */
  command: GameProcessCommandStatus | null;
}

/** Actions on the managed game. */
export type GameProcessAction = 'launch' | 'rebuild' | 'restart' | 'stop';

/** The project level the game is started in. */
export interface GameProcessLevelTarget {
  /** Level name the built level is published under. */
  levelId: string;
  /** Level document path relative to the project's document directory. */
  levelDocument: string;
}

/** Result of opening a project. */
export type ProjectOpenResult = { ok: true; status: GameProcessStatus } | { ok: false; message: string };
