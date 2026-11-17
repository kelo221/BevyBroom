import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { getPrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { PrefabProjectLibrary } from '@/prefab/project/prefab_project_library.js';

/**
 * Connects the shared prefab catalog to the open project's prefab directory: it
 * loads whenever a project opens or the editor window gains focus, and prefabs
 * created or deleted meanwhile are saved there.
 *
 * @param workbench Workbench whose open project is followed.
 * @param control Reads and writes the project's prefab files.
 * @returns The library keeping the catalog up to date.
 */
export function prefabProjectLibrarySetup(
  workbench: ProjectAssetFollowerWorkbench,
  control: GameProcessControl,
): PrefabProjectLibrary {
  return new PrefabProjectLibrary({
    workbench,
    control,
    store: getPrefabCatalogStore(),
    focusTarget: typeof window === 'undefined' ? null : window,
    consoleLog: () => ConsoleLog.shared(),
  });
}
