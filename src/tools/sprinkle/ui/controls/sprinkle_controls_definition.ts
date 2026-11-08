import { Theme } from '@/theme.js';
import { InputSelect } from '@/ui/input/input_select.js';
import { buttonCompactEnabledWrite } from '@/ui/button/button_compact.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import type { SprinkleConfig } from '@/tools/sprinkle/sprinkle_types.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import { SprinkleControls, type SprinkleControlsServices } from './sprinkle_controls.js';

/** Hint shown while the project has no sprinkle definitions. */
export const SPRINKLE_CONTROLS_DEFINITION_EMPTY_HINT =
  "No sprinkle types: add .txt definitions to the project's sprinkle_directories, then Refresh.";

/**
 * Type controls of the Entity Sprinkle window: the definition list, Refresh,
 * Open Source and a notice line showing load problems or a hint when no
 * definitions are loaded.
 */
export class SprinkleControlsDefinition extends SprinkleControls {
  /** Definition list. */
  readonly typeSelect = new InputSelect([], 'Sprinkle type');
  /** Reloads the definitions. */
  readonly refreshButton: HTMLButtonElement;
  /** Opens the active definition's file. */
  readonly openSourceButton: HTMLButtonElement;
  /** Problem or hint line. */
  readonly noticeLine: HTMLElement;

  /**
   * Creates the Type controls.
   *
   * @param services Status reporting.
   */
  constructor(private readonly services: SprinkleControlsServices) {
    super();
    this.refreshButton = this.buttonCreate('Refresh', 'Reload sprinkle definitions', () => void this.refreshRun());
    this.openSourceButton = this.buttonCreate(
      'Open Source',
      'Open the definition file',
      () => void this.sourceOpenRun(),
    );
    this.noticeLine = this.noticeLineCreate();
    this.typeSelect.bindCommit(() => this.typeCommit());
    this.disposerAdd(() => this.typeSelect.dispose());
  }

  /**
   * Shows the definition list, the active definition and the library notice.
   *
   * @param config Current Sprinkle tool configuration.
   * @param activeDefinition Definition the configuration names, or null.
   */
  configShow(config: Readonly<SprinkleConfig>, activeDefinition: SprinkleDefinition | null): void {
    const definitions = getStateSprinkleDefinitionLibrary().definitionsRead();
    this.typeSelect.setChoices(definitions.map((definition) => ({ value: definition.name, label: definition.name })));
    this.typeSelect.setSharedValues(activeDefinition ? [activeDefinition.name] : []);
    buttonCompactEnabledWrite(this.openSourceButton, activeDefinition !== null);
    this.noticeShow(config.definitionName);
  }

  /**
   * Makes the configuration name the first loaded definition when the named one
   * is not loaded. Leaves the name alone while no definitions are loaded.
   */
  definitionFallbackApply(): void {
    const library = getStateSprinkleDefinitionLibrary();
    const firstDefinition = library.definitionsRead()[0];
    const tool = getStateSprinkleTool();
    if (!firstDefinition || library.definitionFind(tool.configRead().definitionName)) {
      return;
    }
    tool.configPatch({ definitionName: firstDefinition.name });
  }

  /** Stores the chosen definition name. */
  private typeCommit(): void {
    const name = this.typeSelect.getValue();
    if (getStateSprinkleDefinitionLibrary().definitionFind(name)) {
      getStateSprinkleTool().configPatch({ definitionName: name });
    }
  }

  /**
   * Reloads the definitions and reports the outcome.
   *
   * @returns Resolves once the reload finished.
   */
  private async refreshRun(): Promise<void> {
    const library = getStateSprinkleDefinitionLibrary();
    try {
      await library.refresh();
      this.services.statusReport(`Sprinkle types loaded: ${library.definitionsRead().length}`);
    } catch (error) {
      this.services.statusReport(`Sprinkle types could not be loaded: ${String(error)}`);
    }
  }

  /**
   * Opens the active definition's file and reports why when it does not open.
   *
   * @returns Resolves once the open request finished.
   */
  private async sourceOpenRun(): Promise<void> {
    const library = getStateSprinkleDefinitionLibrary();
    const definition = library.definitionFind(getStateSprinkleTool().configRead().definitionName);
    if (!definition) {
      return;
    }
    try {
      const problem = await library.sourceOpen(definition);
      if (problem !== null) this.services.statusReport(problem);
    } catch (error) {
      this.services.statusReport(`Sprinkle definition could not be opened: ${String(error)}`);
    }
  }

  /**
   * Shows the library problems, the empty hint, or nothing.
   *
   * @param definitionName Name the configuration holds, or null.
   */
  private noticeShow(definitionName: string | null): void {
    const library = getStateSprinkleDefinitionLibrary();
    const problems = library.problemsRead();
    if (problems.length > 0) {
      this.noticeWrite(this.problemSummaryRead(problems), problems.join('\n'), Theme.severityErrorColor);
      return;
    }
    if (library.definitionsRead().length === 0) {
      const missingText = definitionName === null ? '' : `"${definitionName}" is not loaded.`;
      this.noticeWrite(SPRINKLE_CONTROLS_DEFINITION_EMPTY_HINT, missingText, Theme.secondaryTextColor);
      return;
    }
    this.noticeWrite('', '', Theme.secondaryTextColor);
  }

  /**
   * Summarizes load problems in one line.
   *
   * @param problems Problem descriptions, at least one.
   * @returns Summary text.
   */
  private problemSummaryRead(problems: readonly string[]): string {
    const firstProblem = problems[0] ?? '';
    return problems.length === 1 ? firstProblem : `${problems.length} problems: ${firstProblem}`;
  }

  /**
   * Writes the notice line, hiding it when the text is empty.
   *
   * @param text Line text.
   * @param tooltip Hover text with details.
   * @param color CSS text color.
   */
  private noticeWrite(text: string, tooltip: string, color: string): void {
    this.noticeLine.textContent = text;
    this.noticeLine.title = tooltip;
    this.noticeLine.style.color = color;
    this.noticeLine.style.display = text === '' ? 'none' : 'block';
  }

  /**
   * Creates the notice line element.
   *
   * @returns Notice element.
   */
  private noticeLineCreate(): HTMLElement {
    const line = document.createElement('div');
    line.className = 'sprinkle-controls-definition-notice';
    line.setAttribute('role', 'status');
    line.style.fontFamily = Theme.uiFontFamily;
    line.style.fontSize = `${Theme.uiFontSizePx}px`;
    line.style.overflow = 'hidden';
    line.style.textOverflow = 'ellipsis';
    line.style.whiteSpace = 'nowrap';
    return line;
  }
}
