import type { ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { GameEntityClassProjectLibrary } from '@/game_entity/class/project/game_entity_class_project_library.js';
import { GameEntityClassProjectLevelClasses } from '@/game_entity/class/project/game_entity_class_project_level_classes.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';

/**
 * Connects the shared project class provider to the open project's class file:
 * it loads whenever a project opens or the editor window gains focus, and the
 * console points out level classes the project does not declare.
 *
 * @param workbench Workbench whose open project is followed.
 * @param control Reads and writes the project's class file.
 * @returns The library keeping the provider up to date.
 */
export function gameEntityClassProjectLibrarySetup(
  workbench: ProjectAssetFollowerWorkbench,
  control: GameProcessControl,
): GameEntityClassProjectLibrary {
  const library = new GameEntityClassProjectLibrary({
    workbench,
    control,
    provider: GameEntityClassProviderProject.shared,
    focusTarget: typeof window === 'undefined' ? null : window,
  });
  new GameEntityClassProjectLevelClasses(library, GameEntityClassProviderScene.shared).noticeFollow(
    GameEntityClassProviderProject.shared,
  );
  return library;
}
