import type { GameProcessControl } from '@/project/control/game_process_control.js';
import type { ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import { GameEntityModelProjectFollower } from '@/game_entity/model/game_entity_model_project_follower.js';

/**
 * Points the shared game entity model library at the workbench's open project,
 * reading the models again whenever the editor window gains focus.
 *
 * @param workbench Workbench whose open project is followed.
 * @param control Reads the project's model files.
 * @param statusReport Shows a short message about a model that could not be
 *   loaded.
 * @returns The follower.
 */
export function gameEntityModelProjectSetup(
  workbench: ProjectAssetFollowerWorkbench,
  control: GameProcessControl,
  statusReport: (message: string) => void,
): GameEntityModelProjectFollower {
  return new GameEntityModelProjectFollower({
    workbench,
    control,
    statusReport,
    focusTarget: typeof window === 'undefined' ? null : window,
  });
}
