import type { ProjectLevelOpen } from '@/project/level/project_level_open.js';
import type { GameProcessStatus } from '@/project/process/game_process_types.js';

/** Text shown when the game starts in the open level but none is open. */
export const PROJECT_WORKBENCH_LAUNCH_LEVEL_MISSING_TEXT =
  'Starts in: the open project level (none is open; open or save one first)';

/**
 * Describes which level the game of the open project starts in.
 *
 * @param status Newest status, or null before a project was opened.
 * @param launchLevel Level the game starts in, or null when none is open.
 * @returns Text such as "Starts in: Store (store)", or null when the game takes
 *   no level.
 */
export function projectWorkbenchLaunchLevelTextBuild(
  status: GameProcessStatus | null,
  launchLevel: ProjectLevelOpen | null,
): string | null {
  if (status?.project?.isLevelLaunch !== true) {
    return null;
  }
  if (launchLevel === null) {
    return PROJECT_WORKBENCH_LAUNCH_LEVEL_MISSING_TEXT;
  }
  const preparation = status.project.isLevelExportLaunch ? 'saved and built' : 'saved';
  return `Starts in: ${launchLevel.name} (${launchLevel.id}), ${preparation} before the game starts`;
}
