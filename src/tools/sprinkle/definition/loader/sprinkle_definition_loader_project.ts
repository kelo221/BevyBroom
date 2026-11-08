import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { SprinkleDefinitionBuilder } from '@/tools/sprinkle/definition/builder/sprinkle_definition_builder.js';
import type {
  SprinkleDefinitionLibraryLoader,
  SprinkleDefinitionLibraryLoadResult,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';

/**
 * Loads the sprinkle definitions of the project the process control has open
 * and opens their files in the system's text editor.
 */
export class SprinkleDefinitionLoaderProject implements SprinkleDefinitionLibraryLoader {
  private readonly control: GameProcessControl;
  private readonly builder: SprinkleDefinitionBuilder;

  /**
   * Creates the loader.
   *
   * @param control Reads and opens the project's definition files.
   * @param builder Turns the file texts into definitions.
   */
  constructor(control: GameProcessControl, builder: SprinkleDefinitionBuilder = new SprinkleDefinitionBuilder()) {
    this.control = control;
    this.builder = builder;
  }

  /**
   * Reads and builds every definition file of the open project.
   *
   * @returns Definitions and problems; without readable files no definitions
   *   and the reason as the only problem.
   */
  async load(): Promise<SprinkleDefinitionLibraryLoadResult> {
    const read = await this.control.projectSprinkleDefinitionFilesRead();
    if (!read.ok) {
      return { definitions: [], problems: [read.message] };
    }
    return this.builder.filesBuild(read.files);
  }

  /**
   * Opens a definition file in the system's text editor.
   *
   * @param sourcePath File path relative to the project asset root.
   * @returns Null when the file opened, otherwise why it did not.
   */
  async sourceOpen(sourcePath: string): Promise<string | null> {
    const opened = await this.control.projectSprinkleDefinitionOpen(sourcePath);
    return opened.ok ? null : opened.message;
  }
}
