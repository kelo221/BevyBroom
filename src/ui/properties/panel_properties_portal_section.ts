import { PortalOwner } from '@/portal/model/portal_owner.js';
import type { PortalSettings } from '@/portal/model/portal_settings.js';
import type { InputNumeric } from '@/ui/input/input_numeric.js';
import { inputNumericCreateUvField } from '@/ui/input/input_numeric_uv_field.js';
import type { InputSelect } from '@/ui/input/input_select.js';
import {
  PanelPropertiesEntitySection,
  panelPropertiesEntitySwitchCreate,
  panelPropertiesEntitySwitchValue,
} from '@/ui/properties/panel_properties_entity_section.js';

/**
 * Inspector section for authored portals: opening size and whether it is
 * closed.
 */
export class PanelPropertiesPortalSection extends PanelPropertiesEntitySection<PortalSettings> {
  private readonly widthInput: InputNumeric;
  private readonly heightInput: InputNumeric;
  private readonly closedInput: InputSelect;

  /**
   * Creates the section.
   *
   * @param createSectionContainer Section chrome factory.
   * @param createSectionHeader Header factory.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    super(PortalOwner, 'Portal', createSectionContainer, createSectionHeader);
    this.widthInput = inputNumericCreateUvField(0.1, 'Portal width');
    this.heightInput = inputNumericCreateUvField(0.1, 'Portal height');
    this.closedInput = panelPropertiesEntitySwitchCreate('Portal closed');
    this.rowAppend('Width', this.widthInput);
    this.rowAppend('Height', this.heightInput);
    this.rowAppend('Closed', this.closedInput);
    this.commitsBind();
  }

  /** Binds commit handlers for every field. */
  private commitsBind(): void {
    this.widthInput.bindCommit(() =>
      this.numericCommit(this.widthInput, (settings, width) => ({ ...settings, width })),
    );
    this.heightInput.bindCommit(() =>
      this.numericCommit(this.heightInput, (settings, height) => ({ ...settings, height })),
    );
    this.closedInput.bindCommit(() =>
      this.switchCommit(this.closedInput, (settings, closed) => ({ ...settings, closed })),
    );
  }

  /** Fills every field from the bound portals. */
  protected fieldsWrite(): void {
    const settingsList = this.settingsListRead();
    this.widthInput.setSharedValues(
      settingsList.map((settings) => settings.width),
      2,
    );
    this.heightInput.setSharedValues(
      settingsList.map((settings) => settings.height),
      2,
    );
    this.closedInput.setSharedValues(settingsList.map((settings) => panelPropertiesEntitySwitchValue(settings.closed)));
  }
}
