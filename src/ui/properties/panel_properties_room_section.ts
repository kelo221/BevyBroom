import { RoomOwner } from '@/portal/model/room_owner.js';
import type { RoomSettings } from '@/portal/model/room_settings.js';
import type { InputNumeric } from '@/ui/input/input_numeric.js';
import { inputNumericCreateUvField } from '@/ui/input/input_numeric_uv_field.js';
import { PanelPropertiesEntitySection } from '@/ui/properties/panel_properties_entity_section.js';

/** The room half size fields edited by this section. */
type RoomHalfSizeKey = 'halfSizeX' | 'halfSizeY' | 'halfSizeZ';

/** Row captions of the half size fields. */
const ROOM_SECTION_ROW_LABELS: Readonly<Record<RoomHalfSizeKey, string>> = {
  halfSizeX: 'Half X',
  halfSizeY: 'Half Y',
  halfSizeZ: 'Half Z',
};

/**
 * Inspector section for authored room cells: the half size along each local
 * axis.
 */
export class PanelPropertiesRoomSection extends PanelPropertiesEntitySection<RoomSettings> {
  private readonly halfSizeInputs: Map<RoomHalfSizeKey, InputNumeric>;

  /**
   * Creates the section.
   *
   * @param createSectionContainer Section chrome factory.
   * @param createSectionHeader Header factory.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    super(RoomOwner, 'Room', createSectionContainer, createSectionHeader);
    this.halfSizeInputs = new Map<RoomHalfSizeKey, InputNumeric>([
      ['halfSizeX', inputNumericCreateUvField(0.25, 'Room half size X')],
      ['halfSizeY', inputNumericCreateUvField(0.25, 'Room half size Y')],
      ['halfSizeZ', inputNumericCreateUvField(0.25, 'Room half size Z')],
    ]);
    for (const [key, input] of this.halfSizeInputs) {
      this.rowAppend(ROOM_SECTION_ROW_LABELS[key], input);
      input.bindCommit(() => this.numericCommit(input, (settings, value) => ({ ...settings, [key]: value })));
    }
  }

  /** Fills every field from the bound rooms. */
  protected fieldsWrite(): void {
    const settingsList = this.settingsListRead();
    for (const [key, input] of this.halfSizeInputs) {
      input.setSharedValues(
        settingsList.map((settings) => settings[key]),
        2,
      );
    }
  }
}
