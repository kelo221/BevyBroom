import { LIGHT_FOG_SHAPES } from '@/light/model/features/light_settings_fog.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  PanelPropertiesLightGroup,
  type PanelPropertiesLightGroupHost,
  panelPropertiesLightChoicesCreate,
} from '@/light/ui/properties/panel_properties_light_group.js';

/** Labels of fog shapes whose values do not read well. */
const LIGHT_FOG_SHAPE_LABELS: Readonly<Record<string, string>> = {
  cone_z: 'Cone (forward)',
  cone_y: 'Cone (up)',
};

/** Volumetric fog in the light's color around or in front of the light. */
export class PanelPropertiesLightGroupFog extends PanelPropertiesLightGroup {
  /**
   * Creates the group and its rows.
   *
   * @param host Receives the group's edits.
   */
  constructor(host: PanelPropertiesLightGroupHost) {
    super(host, { title: 'Volumetric fog', iconName: 'weather-fog' });
    this.switchRowAppend('Fog', 'fogEnabled', 'Light fog');
    const shapes = panelPropertiesLightChoicesCreate(LIGHT_FOG_SHAPES, LIGHT_FOG_SHAPE_LABELS);
    const enabled = (settings: LightSettings): boolean => settings.fogEnabled;
    this.rowShownWhen(this.choiceRowAppend('Shape', 'fogShape', shapes, 'Light fog shape'), enabled);
    this.rowShownWhen(this.numberRowAppend('Radius', 'fogRadius', 0.25, 'Light fog radius'), enabled);
    this.rowShownWhen(this.numberRowAppend('Thickness', 'fogThickness', 0.25, 'Light fog thickness'), enabled);
    this.rowShownWhen(this.numberRowAppend('Opacity', 'fogIntensity', 0.05, 'Light fog opacity'), enabled);
    this.rowShownWhen(this.numberRowAppend('Clear', 'fogVisibility', 0.25, 'Light fog clear distance'), enabled);
  }
}
