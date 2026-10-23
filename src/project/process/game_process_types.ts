import type { ProjectProblem } from '@/project/model/project_definition.js';
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
  /** True when the editor knows how to build the game. */
  canBuild: boolean;
  /** Problems found when the project was opened. */
  problems: ProjectProblem[];
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
  /** Newest output lines of builds and the game. */
  logTail: string[];
  /** What happened last, for the user. */
  message: string;
  /** Increases with every action, so callers can tell a newer status apart. */
  generation: number;
}

/** Actions on the managed game. */
export type GameProcessAction = 'launch' | 'rebuild' | 'restart' | 'stop';

/** Result of opening a project. */
export type ProjectOpenResult = { ok: true; status: GameProcessStatus } | { ok: false; message: string };
