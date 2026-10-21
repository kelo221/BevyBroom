import { lightSettingsRadiusWrite } from '@/light/model/features/light_settings_radius.js';
import {
  PanelPropertiesLightGroup,
  type PanelPropertiesLightGroupHost,
} from '@/light/ui/properties/panel_properties_light_group.js';
import type { InputSelectChoice } from '@/ui/input/input_select.js';

/** Light type choices. */
const LIGHT_KIND_CHOICES: readonly InputSelectChoice[] = [
  { value: 'point', label: 'Point' },
  { value: 'spot', label: 'Spot' },
];

/** Shadow mode choices. */
const LIGHT_SHADOW_CHOICES: readonly InputSelectChoice[] = [
  { value: 'raytraced', label: 'Raytraced', title: 'Baked raytraced shadows' },
  { value: 'realtime', label: 'Realtime', title: 'Shadow cubemaps rendered every frame' },
];

/** The always open fields every light has: type, color, range, cone and shadows. */
export class PanelPropertiesLightGroupCore extends PanelPropertiesLightGroup {
  /**
   * Creates the group and its rows.
   *
   * @param host Receives the group's edits.
   */
  constructor(host: PanelPropertiesLightGroupHost) {
    super(host, null);
    this.choiceRowAppend('Type', 'kind', LIGHT_KIND_CHOICES, 'Light type');
    this.switchRowAppend('Enabled', 'enabled', 'Light enabled');
    this.colorRowAppend('Color', 'colorHex', 'Light color');
    this.numberRowAppend('Intensity', 'intensity', 0.1, 'Light intensity');
    this.numberRowAppend('Radius', 'radius', 0.25, 'Light radius', lightSettingsRadiusWrite);
    this.numberRowAppend('Falloff', 'falloff', 0.05, 'Light falloff');
    const isSpot = (settings: { kind: string }): boolean => settings.kind === 'spot';
    this.rowShownWhen(this.numberRowAppend('Inner', 'innerCutoffDegrees', 1, 'Spot inner angle'), isSpot);
    this.rowShownWhen(this.numberRowAppend('Outer', 'outerCutoffDegrees', 1, 'Spot outer angle'), isSpot);
    this.switchRowAppend('Realtime', 'realtime', 'Light realtime');
    this.choiceRowAppend('Shadows', 'shadows', LIGHT_SHADOW_CHOICES, 'Light shadows');
  }
}
