import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';

/** File name of a game project file at the game's root. */
export const PROJECT_FILE_NAME = 'broom.project.json';

/** A game project as the editor uses it: identity, folders and commands. */
export interface ProjectDefinition {
  /** Absolute path of the project file, forward slashes. */
  projectFile: string;
  /** Absolute directory holding the project file, forward slashes. */
  projectDirectory: string;
  /** Stable project id the game reports in the handshake. */
  projectIdentifier: string;
  /** Display name; the project id when the file names none. */
  name: string;
  /** Absolute asset root of the game, forward slashes. */
  assetRoot: string;
  /** Absolute directory holding the game's level packages, forward slashes. */
  levelDirectory: string;
  /** Command that starts the game preview. */
  launch: PreviewLaunchCommand;
  /**
   * Command that builds the game, or null when the project cannot be built by
   * the editor.
   */
  build: PreviewLaunchCommand | null;
}

/** How serious a project problem is; errors stop the game from being started. */
export type ProjectProblemSeverity = 'error' | 'warning';

/** One problem found in a project. */
export interface ProjectProblem {
  severity: ProjectProblemSeverity;
  message: string;
}
