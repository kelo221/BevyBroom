import { LightOwner } from '@/light/model/light_owner.js';
import type { LightKind, LightSettings, LightShadowMode } from '@/light/model/light_settings.js';
import { InputColor } from '@/ui/input/input_color.js';
import type { InputNumeric } from '@/ui/input/input_numeric.js';
import { inputNumericCreateUvField } from '@/ui/input/input_numeric_uv_field.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import {
  PanelPropertiesEntitySection,
  panelPropertiesEntitySwitchCreate,
  panelPropertiesEntitySwitchValue,
} from '@/ui/properties/panel_properties_entity_section.js';

/** The numeric light fields edited by this section. */
type LightNumericKey = 'intensity' | 'radius' | 'falloff' | 'innerCutoffDegrees' | 'outerCutoffDegrees';

/** The boolean light fields edited by this section. */
type LightSwitchKey = 'enabled' | 'realtime';

/** Inspector section for authored point and spot lights. */
export class PanelPropertiesLightSection extends PanelPropertiesEntitySection<LightSettings> {
  private readonly kindInput: InputSelect;
  private readonly colorInput: InputColor;
  private readonly numericInputs: Map<LightNumericKey, InputNumeric>;
  private readonly switchInputs: Map<LightSwitchKey, InputSelect>;
  private readonly shadowInput: InputSelect;
  private readonly spotRows: HTMLElement[];

  /**
   * Creates the section.
   *
   * @param createSectionContainer Section chrome factory.
   * @param createSectionHeader Header factory.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    super(LightOwner, 'Light', createSectionContainer, createSectionHeader);
    this.kindInput = new InputSelect(lightSectionKindChoices(), 'Light type');
    this.colorInput = new InputColor('Light color');
    this.numericInputs = lightSectionNumericInputsCreate();
    this.switchInputs = new Map<LightSwitchKey, InputSelect>([
      ['enabled', panelPropertiesEntitySwitchCreate('Light enabled')],
      ['realtime', panelPropertiesEntitySwitchCreate('Light realtime')],
    ]);
    this.shadowInput = new InputSelect(lightSectionShadowChoices(), 'Light shadows');
    this.spotRows = [];
    this.rowsAppend();
    this.commitsBind();
  }

  /** Appends every labeled row in display order. */
  private rowsAppend(): void {
    this.rowAppend('Type', this.kindInput);
    this.rowAppend('Enabled', this.switchInputRequire('enabled'));
    this.rowAppend('Color', this.colorInput);
    this.rowAppend('Intensity', this.numericInputRequire('intensity'));
    this.rowAppend('Radius', this.numericInputRequire('radius'));
    this.rowAppend('Falloff', this.numericInputRequire('falloff'));
    this.spotRows.push(this.rowAppend('Inner', this.numericInputRequire('innerCutoffDegrees')));
    this.spotRows.push(this.rowAppend('Outer', this.numericInputRequire('outerCutoffDegrees')));
    this.rowAppend('Realtime', this.switchInputRequire('realtime'));
    this.rowAppend('Shadows', this.shadowInput);
  }

  /** Binds commit handlers for every field. */
  private commitsBind(): void {
    this.kindInput.bindCommit(() => this.kindCommit());
    this.colorInput.bindCommit(() =>
      this.settingsCommit((settings) => ({ ...settings, colorHex: this.colorInput.getHexValue() })),
    );
    this.shadowInput.bindCommit(() => this.shadowCommit());
    for (const [key, input] of this.numericInputs) {
      input.bindCommit(() => this.numericCommit(input, (settings, value) => ({ ...settings, [key]: value })));
    }
    for (const [key, input] of this.switchInputs) {
      input.bindCommit(() => this.switchCommit(input, (settings, enabled) => ({ ...settings, [key]: enabled })));
    }
  }

  /** Writes the committed light type. */
  private kindCommit(): void {
    const kind = lightSectionKindFromValue(this.kindInput.getValue());
    if (kind !== null) {
      this.settingsCommit((settings) => ({ ...settings, kind }));
    }
  }

  /** Writes the committed shadow mode. */
  private shadowCommit(): void {
    const shadows = lightSectionShadowFromValue(this.shadowInput.getValue());
    if (shadows !== null) {
      this.settingsCommit((settings) => ({ ...settings, shadows }));
    }
  }

  /** Fills every field from the bound lights. */
  protected fieldsWrite(): void {
    const settingsList = this.settingsListRead();
    this.kindInput.setSharedValues(settingsList.map((settings) => settings.kind));
    this.colorInput.setSharedValues(settingsList.map((settings) => settings.colorHex));
    this.shadowInput.setSharedValues(settingsList.map((settings) => settings.shadows));
    for (const [key, input] of this.numericInputs) {
      input.setSharedValues(
        settingsList.map((settings) => settings[key]),
        2,
      );
    }
    for (const [key, input] of this.switchInputs) {
      input.setSharedValues(settingsList.map((settings) => panelPropertiesEntitySwitchValue(settings[key])));
    }
    this.spotRowsVisibilityWrite(settingsList);
  }

  /**
   * Shows the cone rows only when every bound light is a spot.
   *
   * @param settingsList Settings of the bound lights.
   */
  private spotRowsVisibilityWrite(settingsList: readonly LightSettings[]): void {
    const allSpots = settingsList.length > 0 && settingsList.every((settings) => settings.kind === 'spot');
    for (const row of this.spotRows) {
      row.style.display = allSpots ? 'flex' : 'none';
    }
  }

  /**
   * Returns a numeric field that is always created by the constructor.
   *
   * @param key Settings field.
   * @returns The numeric field.
   */
  private numericInputRequire(key: LightNumericKey): InputNumeric {
    const input = this.numericInputs.get(key);
    if (!input) {
      throw new Error(`Missing light field ${key}`);
    }
    return input;
  }

  /**
   * Returns a switch field that is always created by the constructor.
   *
   * @param key Settings field.
   * @returns The switch select.
   */
  private switchInputRequire(key: LightSwitchKey): InputSelect {
    const input = this.switchInputs.get(key);
    if (!input) {
      throw new Error(`Missing light field ${key}`);
    }
    return input;
  }
}

/**
 * Creates the numeric light fields with their arrow steps.
 *
 * @returns Numeric fields keyed by settings field.
 */
function lightSectionNumericInputsCreate(): Map<LightNumericKey, InputNumeric> {
  return new Map<LightNumericKey, InputNumeric>([
    ['intensity', inputNumericCreateUvField(0.1, 'Light intensity')],
    ['radius', inputNumericCreateUvField(0.25, 'Light radius')],
    ['falloff', inputNumericCreateUvField(0.05, 'Light falloff')],
    ['innerCutoffDegrees', inputNumericCreateUvField(1, 'Spot inner angle')],
    ['outerCutoffDegrees', inputNumericCreateUvField(1, 'Spot outer angle')],
  ]);
}

/**
 * Returns the light type choices.
 *
 * @returns Point and spot entries.
 */
function lightSectionKindChoices(): InputSelectChoice[] {
  return [
    { value: 'point', label: 'Point' },
    { value: 'spot', label: 'Spot' },
  ];
}

/**
 * Returns the shadow mode choices.
 *
 * @returns Raytraced and realtime entries.
 */
function lightSectionShadowChoices(): InputSelectChoice[] {
  return [
    { value: 'raytraced', label: 'Raytraced', title: 'Baked raytraced shadows' },
    { value: 'realtime', label: 'Realtime', title: 'Shadow cubemaps rendered every frame' },
  ];
}

/**
 * Parses a light type select value.
 *
 * @param value Select value.
 * @returns The light kind, or null for a blank or unknown value.
 */
function lightSectionKindFromValue(value: string): LightKind | null {
  return value === 'point' || value === 'spot' ? value : null;
}

/**
 * Parses a shadow mode select value.
 *
 * @param value Select value.
 * @returns The shadow mode, or null for a blank or unknown value.
 */
function lightSectionShadowFromValue(value: string): LightShadowMode | null {
  return value === 'raytraced' || value === 'realtime' ? value : null;
}
