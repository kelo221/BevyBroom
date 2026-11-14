import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import { levelBrowserRowsBuild, type LevelBrowserRow } from '@/level_browser/model/level_browser_row_model.js';
import { LevelBrowserControls, type LevelBrowserControlsHost } from '@/level_browser/ui/level_browser_controls.js';
import { LevelBrowserList } from '@/level_browser/ui/level_browser_list.js';
import { levelBrowserStyleMessage, levelBrowserStyleRoot } from '@/level_browser/ui/level_browser_styles.js';

/** What the level browser needs from the editor. */
export interface LevelBrowserHost {
  /** Actions on the open project's levels. */
  readonly actions: ProjectLevelActions;
  /** Document that owns the browser; the global document when omitted. */
  readonly ownerDocument?: Document;
}

/**
 * Level browser: the levels of the open project with their modified time and
 * the open one marked. Double-click or Open loads a level, New Level starts an
 * empty one, Save As New keeps the open scene as a level and Rename moves a
 * level's document; all three take the typed name.
 */
export class LevelBrowser {
  private readonly host: LevelBrowserHost;
  private readonly root: HTMLElement;
  private readonly message: HTMLElement;
  private readonly list: LevelBrowserList;
  private readonly controls: LevelBrowserControls;
  private readonly listenerRemove: () => void;
  private searchText = '';

  /**
   * Creates the browser and shows the current levels.
   *
   * @param host Editor actions and services.
   */
  constructor(host: LevelBrowserHost) {
    this.host = host;
    const ownerDocument = host.ownerDocument ?? document;
    this.root = ownerDocument.createElement('div');
    this.root.className = 'level-browser';
    levelBrowserStyleRoot(this.root);
    this.message = ownerDocument.createElement('div');
    levelBrowserStyleMessage(this.message);
    this.list = new LevelBrowserList(ownerDocument, {
      rowActivate: (row) => void this.levelOpen(row),
      rowSelect: (row) => this.selectionChanged(row),
    });
    this.controls = new LevelBrowserControls(ownerDocument, this.controlsHostCreate());
    this.root.append(this.message, this.list.element, this.controls.element);
    this.listenerRemove = host.actions.serviceRead().changeListenerAdd(() => this.render());
    this.render();
  }

  /**
   * Returns the root element to mount.
   *
   * @returns Browser element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the list of levels, for keyboard focus.
   *
   * @returns List element.
   */
  listElementRead(): HTMLElement {
    return this.list.element;
  }

  /**
   * Returns the name field, for focusing it when a new level is to be named.
   *
   * @returns Name input.
   */
  nameInputRead(): HTMLInputElement {
    return this.controls.nameInput;
  }

  /** Lists the levels of the project again. */
  refresh(): void {
    void this.host.actions.serviceRead().refresh();
  }

  /** Stops following the project levels. */
  dispose(): void {
    this.listenerRemove();
  }

  /** Redraws the message, the rows and the button enablement. */
  private render(): void {
    const service = this.host.actions.serviceRead();
    const state = service.listStateRead();
    const openDocument = service.openLevelRead()?.document ?? null;
    this.message.textContent = state.message ?? this.listedMessageFormat(state.levels.length, state.documentDirectory);
    this.list.render(levelBrowserRowsBuild(state.levels, openDocument, this.searchText));
    this.controls.enablementShow(state.isAvailable && state.message === null, this.list.selectedRowRead() !== null);
  }

  /**
   * Formats the message shown above a listed project.
   *
   * @param levelCount Number of levels.
   * @param documentDirectory Absolute document directory, or null.
   * @returns Message naming the count and the directory.
   */
  private listedMessageFormat(levelCount: number, documentDirectory: string | null): string {
    const countText = levelCount === 1 ? '1 level' : `${levelCount} levels`;
    return documentDirectory === null ? countText : `${countText} in ${documentDirectory}`;
  }

  /**
   * Builds the callbacks of the controls row.
   *
   * @returns Controls host.
   */
  private controlsHostCreate(): LevelBrowserControlsHost {
    return {
      openRun: () => void this.selectedLevelOpen(),
      newLevelRun: () => void this.host.actions.levelNew(this.controls.nameRead(), true),
      saveAsNewRun: () => void this.host.actions.levelSaveAsNew(this.controls.nameRead()),
      renameRun: () => void this.selectedLevelRename(),
      refreshRun: () => this.refresh(),
      searchTextWrite: (searchText) => this.searchTextWrite(searchText),
    };
  }

  /**
   * Filters the rows.
   *
   * @param searchText Text the shown rows must contain.
   */
  private searchTextWrite(searchText: string): void {
    this.searchText = searchText;
    this.render();
  }

  /**
   * Shows the selected level's name in the name field and updates the buttons.
   *
   * @param row Selected row, or null.
   */
  private selectionChanged(row: LevelBrowserRow | null): void {
    if (row !== null) {
      this.controls.nameWrite(row.level.name);
    }
    this.controls.enablementShow(this.host.actions.serviceRead().listStateRead().message === null, row !== null);
  }

  /** Opens the selected level. */
  private async selectedLevelOpen(): Promise<void> {
    const row = this.list.selectedRowRead();
    if (row !== null) {
      await this.levelOpen(row);
    }
  }

  /**
   * Opens the level of a row after asking about unsaved work.
   *
   * @param row Row to open.
   */
  private async levelOpen(row: LevelBrowserRow): Promise<void> {
    await this.host.actions.levelOpen(row.level.document, true);
  }

  /** Renames the selected level to the typed name. */
  private async selectedLevelRename(): Promise<void> {
    const row = this.list.selectedRowRead();
    if (row === null) {
      return;
    }
    const renamed = await this.host.actions.levelRename(row.level.document, this.controls.nameRead());
    if (renamed.ok) {
      this.list.selectedDocumentWrite(renamed.level.document);
    }
  }
}
