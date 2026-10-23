import type { GameProcessPhase, GameProcessStatus } from '@/project/process/game_process_types.js';
import { ProjectBuildDiagnosticsParser } from '@/project/build/project_build_diagnostics_parser.js';

/** One line of the project status. */
export interface ProjectWorkbenchStatusLine {
  text: string;
  isError: boolean;
}

/** Display names of the game phases. */
const PROJECT_WORKBENCH_PHASE_NAMES: Readonly<Record<GameProcessPhase, string>> = {
  idle: 'Not running',
  building: 'Building',
  build_failed: 'Build failed',
  starting: 'Starting',
  running: 'Running',
  exited: 'Exited',
  stopping: 'Stopping',
  stopped: 'Stopped',
};

/** Most compiler errors listed in the status. */
const PROJECT_WORKBENCH_STATUS_ERROR_LIMIT = 3;

/**
 * Builds the project status lines: project, game phase, last message, project
 * problems, the first build errors and a warning when the document belongs to
 * another project.
 *
 * @param status Newest status, or null before a project was opened.
 * @param isDocumentLinkedElsewhere True when the document belongs to another
 *   project.
 * @returns Lines in display order.
 */
export function projectWorkbenchStatusLinesBuild(
  status: GameProcessStatus | null,
  isDocumentLinkedElsewhere: boolean,
): ProjectWorkbenchStatusLine[] {
  if (status === null || status.project === null) {
    return [{ text: 'No project open. Open a project or connect to a running game.', isError: false }];
  }
  const problemLines = status.project.problems.map((problem) => ({
    text: problem.message,
    isError: problem.severity === 'error',
  }));
  const linkLines = isDocumentLinkedElsewhere
    ? [{ text: 'This document belongs to another project; its game will be refused.', isError: true }]
    : [];
  return [
    ...projectWorkbenchStatusPhaseLinesBuild(status, status.project.name),
    ...problemLines,
    ...projectWorkbenchStatusErrorLinesBuild(status),
    ...linkLines,
  ];
}

/**
 * Builds the project name, game phase and last message lines.
 *
 * @param status Status of the open project.
 * @param projectName Name of the open project.
 * @returns Header lines.
 */
function projectWorkbenchStatusPhaseLinesBuild(
  status: GameProcessStatus,
  projectName: string,
): ProjectWorkbenchStatusLine[] {
  const isFailed = status.phase === 'build_failed';
  const lines: ProjectWorkbenchStatusLine[] = [
    { text: `Project: ${projectName}`, isError: false },
    { text: `Game: ${PROJECT_WORKBENCH_PHASE_NAMES[status.phase]}`, isError: isFailed },
  ];
  return status.message === '' ? lines : [...lines, { text: status.message, isError: isFailed }];
}

/**
 * Builds the lines of the first compiler errors.
 *
 * @param status Status holding the build messages.
 * @returns Error lines, at most the limit.
 */
function projectWorkbenchStatusErrorLinesBuild(status: GameProcessStatus): ProjectWorkbenchStatusLine[] {
  return status.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .slice(0, PROJECT_WORKBENCH_STATUS_ERROR_LIMIT)
    .map((diagnostic) => ({ text: ProjectBuildDiagnosticsParser.describe(diagnostic), isError: true }));
}
