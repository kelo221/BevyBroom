import { createSettingsSecondaryButton, createSettingsTextInput } from '@/ui/settings/settings_form_controls.js';
import { levelBrowserStyleControlsRow } from '@/level_browser/ui/level_browser_styles.js';

/** What the controls report to the browser. */
export interface LevelBrowserControlsHost {
  /** Opens the selected level. */
  openRun(): void;
  /** Creates a new level named by the name field. */
  newLevelRun(): void;
  /** Saves the open scene as a new level named by the name field. */
  saveAsNewRun(): void;
  /** Renames the selected level to the name field. */
  renameRun(): void;
  /** Lists the levels again. */
  refreshRun(): void;
  /**
   * Filters the list.
   *
   * @param searchText Text the shown rows must contain.
   */
  searchTextWrite(searchText: string): void;
}

/**
 * Controls under the list: a search field with Refresh, and a name field with
 * the Open, New Level, Save As New and Rename buttons that act on the selected
 * level or the typed name.
 */
export class LevelBrowserControls {
  readonly element: HTMLElement;
  readonly searchInput: HTMLInputElement;
  readonly nameInput: HTMLInputElement;
  readonly openButton: HTMLButtonElement;
  readonly newLevelButton: HTMLButtonElement;
  readonly saveAsNewButton: HTMLButtonElement;
  readonly renameButton: HTMLButtonElement;
  readonly refreshButton: HTMLButtonElement;

  /**
   * Creates the controls.
   *
   * @param ownerDocument Document that owns the controls.
   * @param host Browser callbacks.
   */
  constructor(ownerDocument: Document, host: LevelBrowserControlsHost) {
    this.element = ownerDocument.createElement('div');
    levelBrowserStyleControlsRow(this.element);
    this.searchInput = this.textInputCreate('Search levels', 'Search', (value) => host.searchTextWrite(value));
    this.refreshButton = this.buttonCreate('Refresh', 'List the levels of the project again', () => host.refreshRun());
    this.nameInput = this.textInputCreate('Level name', 'Level name', () => undefined);
    this.openButton = this.buttonCreate('Open', 'Load the selected level into the editor', () => host.openRun());
    this.newLevelButton = this.buttonCreate('New Level', 'Start an empty level with this name', () =>
      host.newLevelRun(),
    );
    this.saveAsNewButton = this.buttonCreate('Save As New', 'Save the open scene as a level with this name', () =>
      host.saveAsNewRun(),
    );
    this.renameButton = this.buttonCreate('Rename', 'Rename the selected level to this name', () => host.renameRun());
    this.element.append(this.searchInput, this.refreshButton, this.rowBreakCreate(ownerDocument), this.nameInput);
    this.element.append(this.openButton, this.newLevelButton, this.saveAsNewButton, this.renameButton);
  }

  /**
   * Returns the typed level name without surrounding blanks.
   *
   * @returns Level name, possibly empty.
   */
  nameRead(): string {
    return this.nameInput.value.trim();
  }

  /**
   * Shows a name in the name field.
   *
   * @param name Level name.
   */
  nameWrite(name: string): void {
    this.nameInput.value = name;
  }

  /**
   * Enables or disables the buttons that need a project, a selection or a name.
   *
   * @param isAvailable True when the project's levels can be reached.
   * @param hasSelection True when a row is selected.
   */
  enablementShow(isAvailable: boolean, hasSelection: boolean): void {
    this.refreshButton.disabled = !isAvailable;
    this.newLevelButton.disabled = !isAvailable;
    this.saveAsNewButton.disabled = !isAvailable;
    this.openButton.disabled = !isAvailable || !hasSelection;
    this.renameButton.disabled = !isAvailable || !hasSelection;
    this.nameInput.disabled = !isAvailable;
  }

  /**
   * Creates a text field reporting every keystroke.
   *
   * @param ariaLabel Accessible name.
   * @param placeholder Placeholder text.
   * @param onInput Receives the text after every change.
   * @returns Input element.
   */
  private textInputCreate(ariaLabel: string, placeholder: string, onInput: (value: string) => void): HTMLInputElement {
    const input = createSettingsTextInput('', ariaLabel, onInput);
    input.placeholder = placeholder;
    input.style.flex = '1 1 80px';
    input.style.minWidth = '60px';
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  /**
   * Creates one action button.
   *
   * @param label Button text.
   * @param title Tooltip.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private buttonCreate(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = createSettingsSecondaryButton(label, onClick);
    button.title = title;
    return button;
  }

  /**
   * Creates an element that forces the following controls onto a new line.
   *
   * @param ownerDocument Document that owns the controls.
   * @returns Line break element.
   */
  private rowBreakCreate(ownerDocument: Document): HTMLElement {
    const lineBreak = ownerDocument.createElement('div');
    lineBreak.style.flexBasis = '100%';
    lineBreak.style.height = '0';
    return lineBreak;
  }
}
