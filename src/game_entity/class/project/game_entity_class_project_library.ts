import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import type { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import {
  type GameEntityClass,
  type GameEntityClassList,
  gameEntityClassListEmpty,
  gameEntityClassListFromUnknown,
} from '@/game_entity/class/game_entity_class_schema.js';

/** Collaborators of the project class library. */
export interface GameEntityClassProjectLibraryHosts {
  /** Workbench whose open project is followed. */
  workbench: ProjectAssetFollowerWorkbench;
  /** Reads and writes the project's class file. */
  control: GameProcessControl;
  /** Provider that shows the declared classes to the editor. */
  provider: GameEntityClassProvider;
  /**
   * Target whose focus reloads the file, such as the editor window; none when
   * null.
   */
  focusTarget: EventTarget | null;
}

/** What the library knows about the open project's class file. */
export interface GameEntityClassProjectFileState {
  /** True when the project file names a class file. */
  isConfigured: boolean;
  /** Name of the class file, or null when none is named. */
  fileName: string | null;
  /** Why the file could not be read, or null. */
  problem: string | null;
}

/**
 * Keeps the game entity classes declared in the open project's class file in
 * its provider: loads them whenever a project opens or the editor window gains
 * focus, and writes changed classes back to the file.
 */
export class GameEntityClassProjectLibrary extends ProjectAssetFollower {
  private static activeLibrary: GameEntityClassProjectLibrary | null = null;
  private readonly hosts: GameEntityClassProjectLibraryHosts;
  private fileState: GameEntityClassProjectFileState = { isConfigured: false, fileName: null, problem: null };
  private shownText: string | null = null;

  /**
   * Creates the library, makes it the active one and loads the open project.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: GameEntityClassProjectLibraryHosts) {
    super(hosts.workbench);
    this.hosts = hosts;
    GameEntityClassProjectLibrary.activeLibrary = this;
    this.followStart();
    if (hosts.focusTarget !== null) {
      this.focusReloadFollow(hosts.focusTarget);
    }
  }

  /**
   * Returns the library created last and not yet disposed.
   *
   * @returns Active library, or null.
   */
  static activeRead(): GameEntityClassProjectLibrary | null {
    return GameEntityClassProjectLibrary.activeLibrary;
  }

  /** Stops following, empties the provider and stops being the active library. */
  override dispose(): void {
    super.dispose();
    if (GameEntityClassProjectLibrary.activeLibrary === this) {
      GameEntityClassProjectLibrary.activeLibrary = null;
    }
  }

  /**
   * Returns what the library knows about the class file.
   *
   * @returns File state.
   */
  fileStateRead(): GameEntityClassProjectFileState {
    return { ...this.fileState };
  }

  /**
   * Returns the declared classes.
   *
   * @returns Classes in file order.
   */
  classesRead(): GameEntityClass[] {
    return [...this.hosts.provider.listRead().classes];
  }

  /**
   * Adds a class to the file or replaces the class with the same type path.
   *
   * @param gameClass Class to declare.
   * @returns Null when written, otherwise why not.
   */
  async classUpsert(gameClass: GameEntityClass): Promise<string | null> {
    const classes = this.classesRead();
    const index = classes.findIndex((entry) => entry.type_path === gameClass.type_path);
    if (index < 0) {
      classes.push(gameClass);
    } else {
      classes[index] = gameClass;
    }
    return this.classesWrite(classes);
  }

  /**
   * Removes the class with a type path from the file.
   *
   * @param typePath Component type path.
   * @returns Null when written, otherwise why not.
   */
  async classRemove(typePath: string): Promise<string | null> {
    const classes = this.classesRead();
    const remaining = classes.filter((entry) => entry.type_path !== typePath);
    if (remaining.length === classes.length) {
      return `The project declares no class ${typePath}.`;
    }
    return this.classesWrite(remaining);
  }

  /**
   * Adds every given class the file does not declare yet, keeping declared
   * classes as they are.
   *
   * @param candidates Classes to adopt, such as a level's saved snapshot.
   * @returns Type paths adopted, or why nothing was written.
   */
  async classesAdopt(candidates: readonly GameEntityClass[]): Promise<{ adopted: string[] } | { problem: string }> {
    const classes = this.classesRead();
    const declared = new Set(classes.map((entry) => entry.type_path));
    const adopted = candidates.filter((candidate) => !declared.has(candidate.type_path));
    if (adopted.length === 0) {
      return { adopted: [] };
    }
    const problem = await this.classesWrite([...classes, ...adopted]);
    return problem === null ? { adopted: adopted.map((entry) => entry.type_path) } : { problem };
  }

  /** Empties the provider and forgets the file. */
  protected assetsClear(): void {
    this.fileState = { isConfigured: false, fileName: null, problem: null };
    this.shownText = null;
    this.hosts.provider.listWrite(gameEntityClassListEmpty());
  }

  /**
   * Leaves the provider as it is and keeps the reason.
   *
   * @param reason Failure message.
   */
  protected loadFailureShow(reason: string): void {
    this.fileState = { ...this.fileState, problem: reason };
  }

  /**
   * Reads the class file and shows its classes unless a newer load started.
   *
   * @param generation Load generation the load belongs to.
   */
  protected async assetsLoad(generation: number): Promise<void> {
    const read = await this.hosts.control.projectDataFilesRead('entity_classes');
    if (!this.isCurrent(generation)) {
      return;
    }
    if (!read.ok) {
      throw new Error(read.message);
    }
    this.fileState = { isConfigured: read.isConfigured, fileName: read.fixedFileName, problem: null };
    this.textShow(read.files[0]?.text ?? null);
  }

  /**
   * Shows the classes of a class file text unless that text is shown already.
   *
   * @param text File text, or null when the file does not exist.
   */
  private textShow(text: string | null): void {
    if (text === this.shownText) {
      return;
    }
    const list = text === null ? gameEntityClassListEmpty() : this.listParse(text, this.fileState.fileName);
    this.shownText = text;
    this.hosts.provider.listWrite(list);
  }

  /**
   * Parses the text of the class file.
   *
   * @param text File text.
   * @param fileName File name used in messages.
   * @returns Class list.
   * @throws Error naming the file when it is not a class list.
   */
  private listParse(text: string, fileName: string | null): GameEntityClassList {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`${fileName ?? 'The class file'} is not valid JSON: ${String(error)}`);
    }
    const list = gameEntityClassListFromUnknown(parsed);
    if (list === null) {
      throw new Error(`${fileName ?? 'The class file'} must hold an object with a "classes" list`);
    }
    return list;
  }

  /**
   * Writes classes into the class file and shows them.
   *
   * @param classes Classes to declare.
   * @returns Null when written, otherwise why not.
   */
  private async classesWrite(classes: GameEntityClass[]): Promise<string | null> {
    const fileName = this.fileState.fileName;
    if (!this.fileState.isConfigured || fileName === null) {
      return 'The project file names no "entity_classes" file.';
    }
    const list: GameEntityClassList = { ...this.hosts.provider.listRead(), classes };
    const text = `${JSON.stringify({ classes: list.classes, asset_types: list.asset_types }, null, 2)}\n`;
    const written = await this.hosts.control.projectDataFileWrite({ kind: 'entity_classes', name: fileName, text });
    if (!written.ok) {
      return written.message;
    }
    this.shownText = text;
    this.hosts.provider.listWrite(list);
    return null;
  }
}
