import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { gameEntityClassFromUnknown } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassProjectLibrary } from '@/game_entity/class/project/game_entity_class_project_library.js';
import { GameEntityClassProjectLevelClasses } from '@/game_entity/class/project/game_entity_class_project_level_classes.js';

/** Names of the project class tools. */
export const EDITOR_API_PROJECT_CLASS_TOOL_NAMES: readonly string[] = Object.freeze([
  'list_project_classes',
  'set_project_class',
  'remove_project_class',
  'move_level_classes_to_project',
]);

/** Message returned while no project class library exists. */
const EDITOR_API_PROJECT_CLASSES_UNAVAILABLE = 'Open a game project in the desktop app first.';

/** Lists and edits the game entity classes declared in the project's class file. */
export class EditorApiProjectClasses {
  /**
   * Runs a project class tool.
   *
   * @param name Tool name.
   * @param args Argument object.
   * @returns Pending result, or null when the name is not a project class tool.
   */
  classToolDispatchAsync(name: string, args: Record<string, unknown>): Promise<McpToolResult> | null {
    if (!EDITOR_API_PROJECT_CLASS_TOOL_NAMES.includes(name)) {
      return null;
    }
    const library = GameEntityClassProjectLibrary.activeRead();
    if (library === null) {
      return Promise.resolve(failResult(EDITOR_API_PROJECT_CLASSES_UNAVAILABLE));
    }
    switch (name) {
      case 'list_project_classes':
        return Promise.resolve(this.classesList(library));
      case 'set_project_class':
        return this.classSet(library, args);
      case 'remove_project_class':
        return this.classRemove(library, args);
      default:
        return this.levelClassesMove();
    }
  }

  /**
   * Lists the declared classes, the class file and the level classes the file
   * lacks.
   *
   * @param library Project class library.
   * @returns Result with the classes.
   */
  private classesList(library: GameEntityClassProjectLibrary): McpToolResult {
    const classes = library.classesRead();
    return okResult(`${classes.length} project class(es)`, {
      ...library.fileStateRead(),
      classes,
      undeclaredLevelClasses: GameEntityClassProjectLevelClasses.activeCreate()?.undeclaredTypePathsRead() ?? [],
    });
  }

  /**
   * Declares a class, replacing the one with the same type path.
   *
   * @param library Project class library.
   * @param args Argument object with the class.
   * @returns Result with the stored class.
   */
  private async classSet(
    library: GameEntityClassProjectLibrary,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const gameClass = gameEntityClassFromUnknown(args['class']);
    if (gameClass === null) {
      return failResult('set_project_class needs a class object with a type_path');
    }
    const problem = await library.classUpsert(gameClass);
    return problem === null ? okResult(`Declared ${gameClass.type_path}`, gameClass) : failResult(problem);
  }

  /**
   * Removes a declared class.
   *
   * @param library Project class library.
   * @param args Argument object with typePath.
   * @returns Result naming the removed class.
   */
  private async classRemove(
    library: GameEntityClassProjectLibrary,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const typePath = typeof args['typePath'] === 'string' ? args['typePath'] : '';
    const problem = await library.classRemove(typePath);
    return problem === null ? okResult(`Removed ${typePath}`) : failResult(problem);
  }

  /**
   * Moves the open level's undeclared classes into the class file.
   *
   * @returns Result with the outcome message.
   */
  private async levelClassesMove(): Promise<McpToolResult> {
    const levelClasses = GameEntityClassProjectLevelClasses.activeCreate();
    if (levelClasses === null) {
      return failResult(EDITOR_API_PROJECT_CLASSES_UNAVAILABLE);
    }
    const before = levelClasses.undeclaredTypePathsRead();
    const message = await levelClasses.levelClassesMove();
    const after = levelClasses.undeclaredTypePathsRead();
    return after.length === 0 ? okResult(message, { moved: before }) : failResult(message);
  }
}
