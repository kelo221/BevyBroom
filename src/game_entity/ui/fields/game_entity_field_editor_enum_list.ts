import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassVariantNames } from '@/game_entity/class/game_entity_class_variant_names.js';
import { GameEntityComponentValueList } from '@/game_entity/component/game_entity_component_value_list.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import { GameEntityFieldVariantChoices } from '@/game_entity/ui/fields/game_entity_field_variant_choices.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputSelectAction } from '@/ui/input/input_select_action.js';
import { Theme } from '@/theme.js';

/** Label of the add select's resting entry. */
const GAME_ENTITY_ENUM_LIST_ADD_PROMPT = 'Add…';

/**
 * Editor of enum list fields: one row per held variant in order, each with move
 * up, move down and remove buttons, and a select that adds a variant the list
 * does not hold yet. Every edit applies to each bound object's own list.
 */
export class GameEntityFieldEditorEnumList extends GameEntityFieldEditor {
  private readonly element: HTMLElement;

  /**
   * Creates the editor.
   *
   * @param field Enum list field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.element = document.createElement('div');
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '2px';
    this.element.style.minWidth = '0';
  }

  /**
   * Returns the list element.
   *
   * @returns List element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the list of the first object; a note tells when the objects differ.
   *
   * @param values Per-object lists.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    const shown = GameEntityComponentValueList.variantsOf(values[0] ?? null);
    const shownText = JSON.stringify(shown);
    const mixed = values.some((value) => JSON.stringify(GameEntityComponentValueList.variantsOf(value)) !== shownText);
    this.element.replaceChildren();
    if (mixed) {
      this.element.appendChild(this.noteCreate('Mixed; edits apply to each object'));
    }
    shown.forEach((variant, index) => this.element.appendChild(this.rowCreate(variant, index, shown.length)));
    this.element.appendChild(this.addSelectCreate(shown).getElement());
  }

  /**
   * Creates the row of one held variant.
   *
   * @param variant Variant name.
   * @param index Position in the list.
   * @param count Number of held variants.
   * @returns Row element.
   */
  private rowCreate(variant: string, index: number, count: number): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.dataset['enumListVariant'] = variant;
    row.append(this.rowLabelCreate(variant, index), ...this.rowButtonsCreate(variant, index, count));
    return row;
  }

  /**
   * Creates the numbered display name of one held variant; names the field does
   * not list are marked unknown in the warning color.
   *
   * @param variant Variant name.
   * @param index Position in the list.
   * @returns Label element.
   */
  private rowLabelCreate(variant: string, index: number): HTMLElement {
    const label = document.createElement('span');
    const isUnknown = GameEntityComponentValueList.variantsUnknown(this.field, [variant]).length > 0;
    const name = GameEntityClassVariantNames.labelOf(this.field, variant);
    label.textContent = `${index + 1}. ${name}${isUnknown ? ' (unknown)' : ''}`;
    label.title = variant;
    label.style.flex = '1 1 auto';
    label.style.minWidth = '0';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    label.style.color = isUnknown ? Theme.severityWarningColor : Theme.buttonTextColor;
    return label;
  }

  /**
   * Creates the move up, move down and remove buttons of one held variant. Move
   * buttons are left out where the variant cannot move.
   *
   * @param variant Variant name.
   * @param index Position in the list.
   * @param count Number of held variants.
   * @returns Buttons in order.
   */
  private rowButtonsCreate(variant: string, index: number, count: number): HTMLElement[] {
    const name = GameEntityClassVariantNames.labelOf(this.field, variant);
    const buttons: HTMLElement[] = [];
    if (index > 0) {
      buttons.push(this.buttonCreate('▲', `Move ${name} up`, (list) => this.listMoved(list, variant, -1)));
    }
    if (index < count - 1) {
      buttons.push(this.buttonCreate('▼', `Move ${name} down`, (list) => this.listMoved(list, variant, 1)));
    }
    buttons.push(
      this.buttonCreate('✕', `Remove ${name}`, (list) => GameEntityComponentValueList.variantRemove(list, variant)),
    );
    return buttons;
  }

  /**
   * Returns a list with a variant moved.
   *
   * @param list Current names.
   * @param variant Name to move.
   * @param offset Places to move.
   * @returns New list.
   */
  private listMoved(list: readonly string[], variant: string, offset: number): string[] {
    return GameEntityComponentValueList.variantMove(list, variant, offset);
  }

  /**
   * Creates a symbol button that commits a change of each object's list.
   *
   * @param symbol Button text.
   * @param title Tooltip and accessible name.
   * @param change Turns one object's list into its new list.
   * @returns Button element.
   */
  private buttonCreate(symbol: string, title: string, change: (list: readonly string[]) => string[]): HTMLElement {
    return GameEntityUiChrome.iconButtonCreate(symbol, title, () => this.listCommit(change));
  }

  /**
   * Creates the select that adds a variant the shown list does not hold.
   *
   * @param shown Variant names the shown list holds.
   * @returns Select offering the listed variants, grouped like enum fields.
   */
  private addSelectCreate(shown: readonly string[]): InputSelectAction {
    const offered = (this.field.variants ?? []).filter((variant) => !shown.includes(variant));
    const choices = [
      { value: '', label: GAME_ENTITY_ENUM_LIST_ADD_PROMPT },
      ...GameEntityFieldVariantChoices.choicesOf(this.field, offered),
    ];
    const input = new InputSelectAction(choices, `Add ${this.ariaLabel()}`);
    input.setSharedValues(['']);
    input.bindCommit(() => this.variantAddCommit(input.getValue()));
    return input;
  }

  /**
   * Commits adding a variant to the end of each object's list.
   *
   * @param variant Chosen variant name; empty for the prompt entry.
   */
  private variantAddCommit(variant: string): void {
    if (variant !== '') {
      this.listCommit((list) => GameEntityComponentValueList.variantAppend(list, variant));
    }
  }

  /**
   * Commits a change of each object's list.
   *
   * @param change Turns one object's list into its new list.
   */
  private listCommit(change: (list: readonly string[]) => string[]): void {
    this.editCommit((current) => change(GameEntityComponentValueList.variantsOf(current)));
  }

  /**
   * Creates a small note line.
   *
   * @param text Note text.
   * @returns Note element.
   */
  private noteCreate(text: string): HTMLElement {
    const note = document.createElement('span');
    note.textContent = text;
    note.style.color = Theme.statusBarTextColor;
    note.style.fontSize = '11px';
    return note;
  }
}
