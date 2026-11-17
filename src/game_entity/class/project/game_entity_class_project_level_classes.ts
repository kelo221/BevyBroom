import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassProjectLibrary } from '@/game_entity/class/project/game_entity_class_project_library.js';

/** Menu row that moves a level's classes into the project's class file. */
export const GAME_ENTITY_CLASS_PROJECT_MOVE_MENU_LABEL = 'Move Level Classes to Project';

/**
 * Moves the classes a level carries in its own snapshot into the project's
 * class file, and points out levels whose snapshot holds classes the project
 * does not declare yet.
 */
export class GameEntityClassProjectLevelClasses {
  private readonly library: GameEntityClassProjectLibrary;
  private readonly sceneProvider: GameEntityClassProvider;
  private readonly consoleLog: () => ConsoleLog;
  private lastNoticedTypePaths = '';

  /**
   * Creates the helper.
   *
   * @param library Library of the project's class file.
   * @param sceneProvider Provider holding the open level's class snapshot.
   * @param consoleLog Returns the console receiving notices.
   */
  constructor(
    library: GameEntityClassProjectLibrary,
    sceneProvider: GameEntityClassProvider,
    consoleLog: () => ConsoleLog = () => ConsoleLog.shared(),
  ) {
    this.library = library;
    this.sceneProvider = sceneProvider;
    this.consoleLog = consoleLog;
  }

  /**
   * Creates the helper over the active project class library and the open
   * level's class snapshot.
   *
   * @returns Helper, or null while no project class library exists.
   */
  static activeCreate(): GameEntityClassProjectLevelClasses | null {
    const library = GameEntityClassProjectLibrary.activeRead();
    return library === null
      ? null
      : new GameEntityClassProjectLevelClasses(library, GameEntityClassProviderScene.shared);
  }

  /**
   * Returns the type paths of level classes the project's class file does not
   * declare, empty when the project names no class file.
   *
   * @returns Undeclared type paths in level order.
   */
  undeclaredTypePathsRead(): string[] {
    if (!this.library.fileStateRead().isConfigured) {
      return [];
    }
    const declared = new Set(this.library.classesRead().map((entry) => entry.type_path));
    return this.sceneProvider
      .listRead()
      .classes.map((entry) => entry.type_path)
      .filter((typePath) => !declared.has(typePath));
  }

  /**
   * Writes the level's undeclared classes into the class file and reports the
   * outcome in the console.
   *
   * @returns The reported message.
   */
  async levelClassesMove(): Promise<string> {
    const result = await this.library.classesAdopt(this.sceneProvider.listRead().classes);
    if ('problem' in result) {
      this.consoleLog().entryAppendError(`Classes not moved: ${result.problem}`);
      return result.problem;
    }
    const message =
      result.adopted.length === 0
        ? 'The project already declares every class of this level.'
        : `Moved ${result.adopted.length} class(es) into the project: ${result.adopted.join(', ')}.`;
    this.consoleLog().entryAppendInfo(message);
    return message;
  }

  /**
   * Tells the console once per distinct set when the level holds classes the
   * project does not declare, naming the menu row that moves them.
   */
  undeclaredNoticeShow(): void {
    const undeclared = this.undeclaredTypePathsRead();
    const key = undeclared.join('\n');
    if (key === this.lastNoticedTypePaths) {
      return;
    }
    this.lastNoticedTypePaths = key;
    if (undeclared.length > 0) {
      this.consoleLog().entryAppendWarning(
        `This level carries ${undeclared.length} class(es) the project's class file does not declare (${undeclared.join(', ')}). Use File > ${GAME_ENTITY_CLASS_PROJECT_MOVE_MENU_LABEL} to share them with every level.`,
      );
    }
  }

  /**
   * Shows the notice whenever the level's snapshot or the project's classes
   * change.
   *
   * @param projectProvider Provider holding the project's classes.
   * @returns Function that stops listening.
   */
  noticeFollow(projectProvider: GameEntityClassProvider): () => void {
    const removeScene = this.sceneProvider.changeListenerAdd(() => this.undeclaredNoticeShow());
    const removeProject = projectProvider.changeListenerAdd(() => this.undeclaredNoticeShow());
    return () => {
      removeScene();
      removeProject();
    };
  }
}
