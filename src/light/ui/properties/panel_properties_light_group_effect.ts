import { LIGHT_EFFECT_KINDS } from '@/light/model/features/light_settings_effect.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  PanelPropertiesLightGroup,
  type PanelPropertiesLightGroupHost,
  panelPropertiesLightChoicesCreate,
} from '@/light/ui/properties/panel_properties_light_group.js';

/** Effects whose speed field matters. */
const LIGHT_EFFECTS_WITH_SPEED: readonly string[] = ['pulse', 'pulsar', 'generator', 'lightning', 'cloudy', 'overcast'];

/** Effects that advance in fixed steps. */
const LIGHT_EFFECTS_WITH_STEP: readonly string[] = ['random', 'strobe', 'flicker'];

/** Intensity animation of a light: flicker, candle, strobe and more. */
export class PanelPropertiesLightGroupEffect extends PanelPropertiesLightGroup {
  /**
   * Creates the group and its rows.
   *
   * @param host Receives the group's edits.
   */
  constructor(host: PanelPropertiesLightGroupHost) {
    super(host, { title: 'Effect', iconName: 'flash' });
    this.choiceRowAppend('Effect', 'effectKind', panelPropertiesLightChoicesCreate(LIGHT_EFFECT_KINDS), 'Light effect');
    const animated = (settings: LightSettings): boolean => settings.effectKind !== 'steady';
    const hasSpeed = (settings: LightSettings): boolean => LIGHT_EFFECTS_WITH_SPEED.includes(settings.effectKind);
    const hasStep = (settings: LightSettings): boolean => LIGHT_EFFECTS_WITH_STEP.includes(settings.effectKind);
    this.rowShownWhen(this.numberRowAppend('Speed', 'effectPulseSpeed', 0.1, 'Light effect speed'), hasSpeed);
    this.rowShownWhen(this.numberRowAppend('Min', 'effectPulseModifier', 0.05, 'Light effect minimum'), animated);
    this.rowShownWhen(this.numberRowAppend('Offset', 'effectPulseOffset', 0.1, 'Light effect offset'), animated);
    this.rowShownWhen(this.numberRowAppend('Step', 'effectTimestep', 0.01, 'Light effect step'), hasStep);
  }
}
