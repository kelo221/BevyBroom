import type { LightSettings } from '@/light/model/light_settings.js';
import { Theme } from '@/theme.js';
import { InputColor } from '@/ui/input/input_color.js';
import type { InputNumeric } from '@/ui/input/input_numeric.js';
import { inputNumericCreateUvField } from '@/ui/input/input_numeric_uv_field.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { panelPropertiesSectionHeaderIconWrite } from '@/ui/properties/panel_properties_chrome.js';
import {
  panelPropertiesEntitySwitchCreate,
  panelPropertiesEntitySwitchValue,
} from '@/ui/properties/panel_properties_entity_section.js';
import { panelPropertiesRowCreate, type PanelPropertiesRowField } from '@/ui/properties/panel_properties_row.js';

/** Keys of light settings fields holding values of one type. */
type LightSettingsKeyOfType<TValue> = {
  [TKey in keyof LightSettings]-?: LightSettings[TKey] extends TValue ? TKey : never;
}[keyof LightSettings];

/** Numeric light settings fields. */
export type LightSettingsNumberKey = LightSettingsKeyOfType<number>;

/** Boolean light settings fields. */
export type LightSettingsBooleanKey = LightSettingsKeyOfType<boolean>;

/** Light settings fields holding one of a fixed set of choices. */
export type LightSettingsChoiceKey = Exclude<LightSettingsKeyOfType<string>, 'cookieTexture'>;

/** Builds the next settings of one light from its current settings. */
export type LightSettingsEdit = (settings: LightSettings) => LightSettings;

/** Commits edits of the lights a light group shows. */
export interface PanelPropertiesLightGroupHost {
  /** Pushes one undoable edit of every bound light. */
  settingsCommit(edit: LightSettingsEdit): void;
  /** Commits a numeric field, restoring the fields when its text is invalid. */
  numericCommit(input: InputNumeric, apply: (settings: LightSettings, value: number) => LightSettings): void;
  /** Commits an on/off select. */
  switchCommit(input: InputSelect, apply: (settings: LightSettings, enabled: boolean) => LightSettings): void;
}

/** Title and icon of a collapsible group header. */
export interface PanelPropertiesLightGroupHeader {
  readonly title: string;
  readonly iconName: IconName;
}

/** Writes one part of a group from the settings of the bound lights. */
type PanelPropertiesLightGroupWriter = (settingsList: readonly LightSettings[]) => void;

/**
 * Collapsible group of light fields inside the light section, such as the
 * effect or the fog settings. Groups declare their rows; the base class binds
 * commits, fills the fields and hides rows that do not apply.
 */
export abstract class PanelPropertiesLightGroup {
  protected readonly host: PanelPropertiesLightGroupHost;
  private readonly element: HTMLElement;
  private readonly content: HTMLElement;
  private readonly writers: PanelPropertiesLightGroupWriter[];

  /**
   * Creates the group: collapsed below a header, or always open without one.
   *
   * @param host Receives the group's edits.
   * @param header Title and icon of a collapsible header, or null for an always
   *   open group.
   */
  protected constructor(host: PanelPropertiesLightGroupHost, header: PanelPropertiesLightGroupHeader | null) {
    this.host = host;
    this.writers = [];
    this.element = document.createElement('div');
    this.content = document.createElement('div');
    if (header) {
      this.content.style.display = 'none';
      this.element.appendChild(this.headerCreate(header));
    }
    this.element.appendChild(this.content);
  }

  /**
   * Returns the group element.
   *
   * @returns Group root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the group when it applies to every bound light and fills its fields.
   *
   * @param settingsList Settings of the bound lights.
   */
  fieldsWrite(settingsList: readonly LightSettings[]): void {
    const shown = settingsList.length > 0 && settingsList.every((settings) => this.appliesTo(settings));
    this.element.style.display = shown ? 'block' : 'none';
    if (shown) {
      this.writers.forEach((writer) => writer(settingsList));
    }
  }

  /**
   * Returns whether the group applies to a light. Groups for some light kinds
   * override it; by default every light shows the group.
   *
   * @param settings Light settings.
   * @returns True when the group applies.
   */
  protected appliesTo(settings: LightSettings): boolean {
    void settings;
    return true;
  }

  /**
   * Appends a labeled row to the group content.
   *
   * @param labelText Row caption.
   * @param field Row field.
   * @returns Row element.
   */
  protected rowAppend(labelText: string, field: PanelPropertiesRowField): HTMLElement {
    const row = panelPropertiesRowCreate(labelText, field);
    this.content.appendChild(row);
    return row;
  }

  /**
   * Registers a step that fills part of the group from the bound lights.
   *
   * @param writer Fill step.
   */
  protected writerAdd(writer: PanelPropertiesLightGroupWriter): void {
    this.writers.push(writer);
  }

  /**
   * Shows a row only while every bound light satisfies a condition.
   *
   * @param row Row element.
   * @param condition Condition on one light's settings.
   */
  protected rowShownWhen(row: HTMLElement, condition: (settings: LightSettings) => boolean): void {
    this.writerAdd((settingsList) => {
      row.style.display = settingsList.every(condition) ? 'flex' : 'none';
    });
  }

  /**
   * Appends a numeric row bound to a settings field.
   *
   * @param labelText Row caption.
   * @param key Settings field.
   * @param step Arrow step of the field.
   * @param ariaLabel Accessible name of the field.
   * @param apply Writes a committed value into settings; sets the field by
   *   default.
   * @returns Row element.
   */
  protected numberRowAppend(
    labelText: string,
    key: LightSettingsNumberKey,
    step: number,
    ariaLabel: string,
    apply: (settings: LightSettings, value: number) => LightSettings = (settings, value) => ({
      ...settings,
      [key]: value,
    }),
  ): HTMLElement {
    const input = inputNumericCreateUvField(step, ariaLabel);
    input.bindCommit(() => this.host.numericCommit(input, apply));
    this.writerAdd((settingsList) =>
      input.setSharedValues(
        settingsList.map((settings) => settings[key]),
        2,
      ),
    );
    return this.rowAppend(labelText, input);
  }

  /**
   * Appends an on/off row bound to a settings field.
   *
   * @param labelText Row caption.
   * @param key Settings field.
   * @param ariaLabel Accessible name of the field.
   * @returns Row element.
   */
  protected switchRowAppend(labelText: string, key: LightSettingsBooleanKey, ariaLabel: string): HTMLElement {
    const input = panelPropertiesEntitySwitchCreate(ariaLabel);
    input.bindCommit(() => this.host.switchCommit(input, (settings, enabled) => ({ ...settings, [key]: enabled })));
    this.writerAdd((settingsList) =>
      input.setSharedValues(settingsList.map((settings) => panelPropertiesEntitySwitchValue(settings[key]))),
    );
    return this.rowAppend(labelText, input);
  }

  /**
   * Appends a choice row bound to a settings field. Only listed choices are
   * committed, so a blank mixed value never overwrites the lights.
   *
   * @param labelText Row caption.
   * @param key Settings field.
   * @param choices Selectable values with their labels.
   * @param ariaLabel Accessible name of the field.
   * @returns Row element.
   */
  protected choiceRowAppend(
    labelText: string,
    key: LightSettingsChoiceKey,
    choices: readonly InputSelectChoice[],
    ariaLabel: string,
  ): HTMLElement {
    const input = new InputSelect(choices, ariaLabel);
    input.bindCommit(() => this.choiceCommit(input, key, choices));
    this.writerAdd((settingsList) => input.setSharedValues(settingsList.map((settings) => settings[key])));
    return this.rowAppend(labelText, input);
  }

  /**
   * Appends a color row bound to a 0xRRGGBB settings field.
   *
   * @param labelText Row caption.
   * @param key Settings field.
   * @param ariaLabel Accessible name of the field.
   * @returns Row element.
   */
  protected colorRowAppend(labelText: string, key: LightSettingsNumberKey, ariaLabel: string): HTMLElement {
    const input = new InputColor(ariaLabel);
    input.bindCommit(() => this.host.settingsCommit((settings) => ({ ...settings, [key]: input.getHexValue() })));
    this.writerAdd((settingsList) => input.setSharedValues(settingsList.map((settings) => settings[key])));
    return this.rowAppend(labelText, input);
  }

  /**
   * Commits a choice when the select holds one of the listed values.
   *
   * @param input Choice select.
   * @param key Settings field.
   * @param choices Selectable values.
   */
  private choiceCommit(input: InputSelect, key: LightSettingsChoiceKey, choices: readonly InputSelectChoice[]): void {
    const value = input.getValue();
    if (choices.some((choice) => choice.value === value)) {
      this.host.settingsCommit((settings) => ({ ...settings, [key]: value }));
    }
  }

  /**
   * Creates the clickable header that expands and collapses the group.
   *
   * @param groupHeader Header title and icon.
   * @returns Header element.
   */
  private headerCreate(groupHeader: PanelPropertiesLightGroupHeader): HTMLElement {
    const header = document.createElement('div');
    header.textContent = groupHeader.title;
    header.setAttribute('role', 'button');
    header.style.cssText = 'cursor:pointer;font:600 11px monospace;padding:4px 8px 6px;user-select:none;';
    header.style.color = Theme.buttonTextColor;
    panelPropertiesSectionHeaderIconWrite(header, groupHeader.iconName);
    header.addEventListener('click', () => this.contentToggle());
    return header;
  }

  /** Expands the group content when collapsed and collapses it when expanded. */
  private contentToggle(): void {
    this.content.style.display = this.content.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Returns a readable label for a snake_case choice value.
 *
 * @param value Choice value such as `fluorescent_starter`.
 * @returns Label such as `Fluorescent starter`.
 */
export function panelPropertiesLightChoiceLabel(value: string): string {
  const words = value.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Builds select choices from choice values with readable labels.
 *
 * @param values Choice values.
 * @param labels Labels that replace the generated ones.
 * @returns Select choices.
 */
export function panelPropertiesLightChoicesCreate(
  values: readonly string[],
  labels: Readonly<Record<string, string>> = {},
): InputSelectChoice[] {
  return values.map((value) => ({ value, label: labels[value] ?? panelPropertiesLightChoiceLabel(value) }));
}
