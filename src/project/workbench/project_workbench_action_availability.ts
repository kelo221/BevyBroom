import type { GameProcessAction, GameProcessPhase, GameProcessStatus } from '@/project/process/game_process_types.js';

/** Phases in which the game can be started from scratch. */
const PROJECT_WORKBENCH_LAUNCH_PHASES: readonly GameProcessPhase[] = ['idle', 'build_failed', 'exited', 'stopped'];

/** Phases in which a managed process is busy or alive and can be stopped. */
const PROJECT_WORKBENCH_STOP_PHASES: readonly GameProcessPhase[] = ['building', 'starting', 'running'];

/** Phases in which nothing new may start yet. */
const PROJECT_WORKBENCH_BUSY_PHASES: readonly GameProcessPhase[] = ['building', 'starting', 'stopping'];

/**
 * Returns whether an action makes sense for a status, so buttons and menu
 * entries offer only the useful recovery steps.
 *
 * @param status Newest status, or null before a project was opened.
 * @param action Action to check.
 * @returns True when the action is offered.
 */
export function projectWorkbenchActionIsAvailable(
  status: GameProcessStatus | null,
  action: GameProcessAction,
): boolean {
  const project = status?.project ?? null;
  if (status === null || project === null || project.problems.some((problem) => problem.severity === 'error')) {
    return false;
  }
  if (!project.canLaunch) {
    return action === 'stop' && PROJECT_WORKBENCH_STOP_PHASES.includes(status.phase);
  }
  if (action === 'stop') {
    return PROJECT_WORKBENCH_STOP_PHASES.includes(status.phase);
  }
  if (action === 'launch') {
    return PROJECT_WORKBENCH_LAUNCH_PHASES.includes(status.phase);
  }
  if (action === 'rebuild') {
    return project.canBuild && !PROJECT_WORKBENCH_BUSY_PHASES.includes(status.phase);
  }
  return !PROJECT_WORKBENCH_BUSY_PHASES.includes(status.phase) && status.phase !== 'idle';
}

/**
 * Returns whether Play Level in Game can run: it starts, rebuilds or restarts
 * the game, whichever fits the phase.
 *
 * @param status Newest status, or null before a project was opened.
 * @returns True when one of those actions is available.
 */
export function projectWorkbenchLevelPlayIsAvailable(status: GameProcessStatus | null): boolean {
  const actions: readonly GameProcessAction[] = ['launch', 'rebuild', 'restart'];
  return actions.some((action) => projectWorkbenchActionIsAvailable(status, action));
}
