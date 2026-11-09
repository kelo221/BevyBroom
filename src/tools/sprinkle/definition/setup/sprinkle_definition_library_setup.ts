import type { GameProcessControl } from '@/project/control/game_process_control.js';
import {
  SprinkleDefinitionLibraryProjectFollower,
  type SprinkleDefinitionLibraryWorkbench,
} from '@/tools/sprinkle/definition/loader/sprinkle_definition_library_project_follower.js';
import { SprinkleDefinitionLoaderProject } from '@/tools/sprinkle/definition/loader/sprinkle_definition_loader_project.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';

/**
 * Connects the shared sprinkle definition library to the open project: its
 * loader reads through the process control and it reloads whenever a project
 * opens.
 *
 * @param workbench Workbench whose open project is followed.
 * @param control Reads and opens the project's definition files.
 * @returns The follower keeping the library up to date.
 */
export function sprinkleDefinitionLibraryProjectSetup(
  workbench: SprinkleDefinitionLibraryWorkbench,
  control: GameProcessControl,
): SprinkleDefinitionLibraryProjectFollower {
  return new SprinkleDefinitionLibraryProjectFollower({
    workbench,
    library: getStateSprinkleDefinitionLibrary(),
    loader: new SprinkleDefinitionLoaderProject(control),
  });
}
