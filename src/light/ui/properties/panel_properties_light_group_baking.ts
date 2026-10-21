import {
  LIGHT_BOUNCE_COMPRESSIONS,
  LIGHT_ILLUMINATION_MODES,
  LIGHT_TRANSPARENCY_MODES,
} from '@/light/model/features/light_settings_baking.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  PanelPropertiesLightGroup,
  type PanelPropertiesLightGroupHost,
  panelPropertiesLightChoicesCreate,
} from '@/light/ui/properties/panel_properties_light_group.js';

/** Labels of choices whose values do not read well. */
const LIGHT_BAKING_CHOICE_LABELS: Readonly<Record<string, string>> = {
  enabled_max: 'Enabled (max)',
  bits8: '8 bits',
  bits6: '6 bits',
  bits5: '5 bits',
  bits4: '4 bits',
};

/** How a light takes part in the bake: bounce light and transparent shadows. */
export class PanelPropertiesLightGroupBaking extends PanelPropertiesLightGroup {
  /**
   * Creates the group and its rows.
   *
   * @param host Receives the group's edits.
   */
  constructor(host: PanelPropertiesLightGroupHost) {
    super(host, { title: 'Baking', iconName: 'fire' });
    const choices = (values: readonly string[]) =>
      panelPropertiesLightChoicesCreate(values, LIGHT_BAKING_CHOICE_LABELS);
    this.choiceRowAppend('Bounce', 'illumination', choices(LIGHT_ILLUMINATION_MODES), 'Light illumination');
    this.choiceRowAppend('See-thru', 'transparency', choices(LIGHT_TRANSPARENCY_MODES), 'Light transparency');
    const bounces = (settings: LightSettings): boolean => settings.illumination === 'single_bounce';
    this.rowShownWhen(this.colorRowAppend('Tint', 'bounceColorHex', 'Light bounce tint'), bounces);
    this.rowShownWhen(this.numberRowAppend('Tint mix', 'bounceColorAlpha', 0.05, 'Light bounce tint mix'), bounces);
    this.rowShownWhen(this.numberRowAppend('Visible', 'bounceModifier', 0.05, 'Light bounce visibility'), bounces);
    this.rowShownWhen(this.numberRowAppend('Strength', 'bounceIntensity', 0.1, 'Light bounce strength'), bounces);
    this.rowShownWhen(this.numberRowAppend('Samples', 'bounceSamples', 1, 'Light bounce samples'), bounces);
    const compressions = choices(LIGHT_BOUNCE_COMPRESSIONS);
    this.rowShownWhen(
      this.choiceRowAppend('Storage', 'bounceCompression', compressions, 'Light bounce storage'),
      bounces,
    );
  }
}
