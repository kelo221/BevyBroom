import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import type { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import { panelPropertiesRowCreate, type PanelPropertiesRowField } from '@/ui/properties/panel_properties_row.js';

/** Select value for an enabled boolean. */
const PANEL_PROPERTIES_ENTITY_SWITCH_ON = 'on';

/** Select value for a disabled boolean. */
const PANEL_PROPERTIES_ENTITY_SWITCH_OFF = 'off';

/**
 * Inspector section for entities of one kind. It shows itself when every
 * selected object is an owner of that kind and turns every committed field into
 * one undoable settings edit of all of them.
 */
export abstract class PanelPropertiesEntitySection<TSettings extends object> {
  protected readonly section: HTMLElement;
  protected boundOwners: THREE.Object3D[];
  private readonly entityOwner: EntityOwner<TSettings>;
  private commandStack: CommandStack | null;

  /**
   * Creates the section chrome.
   *
   * @param entityOwner Owner helper of the edited kind.
   * @param title Section header text.
   * @param createSectionContainer Section chrome factory.
   * @param createSectionHeader Header factory.
   */
  protected constructor(
    entityOwner: EntityOwner<TSettings>,
    title: string,
    createSectionContainer: () => HTMLElement,
    createSectionHeader: (title: string) => HTMLElement,
  ) {
    this.entityOwner = entityOwner;
    this.commandStack = null;
    this.boundOwners = [];
    this.section = createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(createSectionHeader(title));
  }

  /** Fills every field from the bound owners. */
  protected abstract fieldsWrite(): void;

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.section;
  }

  /**
   * Sets the undo stack used by edits.
   *
   * @param stack Command stack, or null to apply edits without history.
   */
  setCommandStack(stack: CommandStack | null): void {
    this.commandStack = stack;
  }

  /**
   * Shows the section when every selected object is an owner of this kind and
   * fills it with the shared values.
   *
   * @param objects Current inspector selection.
   */
  updateFromObjects(objects: readonly THREE.Object3D[]): void {
    this.boundOwners = objects.filter((object) => this.entityOwner.isOwner(object));
    const onlyOwners = objects.length > 0 && this.boundOwners.length === objects.length;
    this.section.style.display = onlyOwners ? 'block' : 'none';
    if (onlyOwners) {
      this.fieldsWrite();
    }
  }

  /**
   * Appends one labeled row and returns it.
   *
   * @param labelText Row caption.
   * @param field Row field.
   * @returns The row element.
   */
  protected rowAppend(labelText: string, field: PanelPropertiesRowField): HTMLElement {
    const row = panelPropertiesRowCreate(labelText, field);
    this.section.appendChild(row);
    return row;
  }

  /**
   * Returns the settings of every bound owner.
   *
   * @returns Settings in selection order.
   */
  protected settingsListRead(): TSettings[] {
    return this.boundOwners
      .map((owner) => this.entityOwner.settingsRead(owner))
      .filter((settings): settings is TSettings => settings !== null);
  }

  /**
   * Pushes one undoable settings edit for every bound owner and refreshes the
   * fields.
   *
   * @param edit Builds the next settings from an owner's current settings.
   */
  protected settingsCommit(edit: (settings: TSettings) => TSettings): void {
    const command = new CommandEntitySettingsSet(this.entityOwner, this.boundOwners, edit);
    if (!command.hasChanges()) {
      return;
    }
    if (this.commandStack) {
      this.commandStack.push(command);
    } else {
      command.execute();
    }
    this.fieldsWrite();
  }

  /**
   * Commits a numeric field, restoring the fields when the text is invalid.
   *
   * @param input Numeric field.
   * @param apply Returns settings with the committed number applied.
   */
  protected numericCommit(input: InputNumeric, apply: (settings: TSettings, value: number) => TSettings): void {
    const value = input.parseNumberOrNull();
    if (value === null) {
      this.fieldsWrite();
      return;
    }
    this.settingsCommit((settings) => apply(settings, value));
  }

  /**
   * Commits an on/off select.
   *
   * @param input Switch select.
   * @param apply Returns settings with the committed boolean applied.
   */
  protected switchCommit(input: InputSelect, apply: (settings: TSettings, enabled: boolean) => TSettings): void {
    const value = input.getValue();
    if (value === PANEL_PROPERTIES_ENTITY_SWITCH_ON || value === PANEL_PROPERTIES_ENTITY_SWITCH_OFF) {
      this.settingsCommit((settings) => apply(settings, value === PANEL_PROPERTIES_ENTITY_SWITCH_ON));
    }
  }
}

/**
 * Creates an on/off select.
 *
 * @param title Tooltip and accessible name.
 * @returns Switch select.
 */
export function panelPropertiesEntitySwitchCreate(title: string): InputSelect {
  const choices: InputSelectChoice[] = [
    { value: PANEL_PROPERTIES_ENTITY_SWITCH_ON, label: 'On' },
    { value: PANEL_PROPERTIES_ENTITY_SWITCH_OFF, label: 'Off' },
  ];
  return new InputSelect(choices, title);
}

/**
 * Converts a boolean into its switch select value.
 *
 * @param enabled Boolean field value.
 * @returns The on or off value.
 */
export function panelPropertiesEntitySwitchValue(enabled: boolean): string {
  return enabled ? PANEL_PROPERTIES_ENTITY_SWITCH_ON : PANEL_PROPERTIES_ENTITY_SWITCH_OFF;
}
