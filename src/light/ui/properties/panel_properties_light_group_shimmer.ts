import { LIGHT_SHIMMER_KINDS } from '@/light/model/features/light_settings_shimmer.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  PanelPropertiesLightGroup,
  type PanelPropertiesLightGroupHost,
  panelPropertiesLightChoicesCreate,
} from '@/light/ui/properties/panel_properties_light_group.js';

/** Flickering block pattern a light projects, such as water caustics. */
export class PanelPropertiesLightGroupShimmer extends PanelPropertiesLightGroup {
  /**
   * Creates the group and its rows.
   *
   * @param host Receives the group's edits.
   */
  constructor(host: PanelPropertiesLightGroupHost) {
    super(host, { title: 'Shimmer', iconName: 'shimmer' });
    const kinds = panelPropertiesLightChoicesCreate(LIGHT_SHIMMER_KINDS);
    this.choiceRowAppend('Shimmer', 'shimmer', kinds, 'Light shimmer');
    const active = (settings: LightSettings): boolean => settings.shimmer !== 'none';
    this.rowShownWhen(this.numberRowAppend('Scale', 'shimmerScale', 0.25, 'Light shimmer scale'), active);
    this.rowShownWhen(this.numberRowAppend('Min', 'shimmerModifier', 0.05, 'Light shimmer minimum'), active);
  }
}
