import { LightOwner } from '@/light/model/light_owner.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import type {
  PanelPropertiesLightGroup,
  PanelPropertiesLightGroupHost,
} from '@/light/ui/properties/panel_properties_light_group.js';
import { PanelPropertiesLightGroupBaking } from '@/light/ui/properties/panel_properties_light_group_baking.js';
import { PanelPropertiesLightGroupCookie } from '@/light/ui/properties/panel_properties_light_group_cookie.js';
import { PanelPropertiesLightGroupCore } from '@/light/ui/properties/panel_properties_light_group_core.js';
import { PanelPropertiesLightGroupEffect } from '@/light/ui/properties/panel_properties_light_group_effect.js';
import { PanelPropertiesLightGroupFog } from '@/light/ui/properties/panel_properties_light_group_fog.js';
import { PanelPropertiesLightGroupShimmer } from '@/light/ui/properties/panel_properties_light_group_shimmer.js';
import { PanelPropertiesEntitySection } from '@/ui/properties/panel_properties_entity_section.js';

/**
 * Inspector section for authored point and spot lights: the always open light
 * fields, then collapsible effect, cookie, fog, shimmer and baking groups.
 */
export class PanelPropertiesLightSection extends PanelPropertiesEntitySection<LightSettings> {
  private readonly groups: PanelPropertiesLightGroup[];

  /**
   * Creates the section.
   *
   * @param createSectionContainer Section chrome factory.
   * @param createSectionHeader Header factory.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    super(LightOwner, 'Light', createSectionContainer, createSectionHeader);
    const host = this.groupHostCreate();
    this.groups = [
      new PanelPropertiesLightGroupCore(host),
      new PanelPropertiesLightGroupEffect(host),
      new PanelPropertiesLightGroupCookie(host),
      new PanelPropertiesLightGroupFog(host),
      new PanelPropertiesLightGroupShimmer(host),
      new PanelPropertiesLightGroupBaking(host),
    ];
    this.groups.forEach((group) => this.section.appendChild(group.getElement()));
  }

  /** Fills every group from the bound lights. */
  protected fieldsWrite(): void {
    const settingsList = this.settingsListRead();
    this.groups.forEach((group) => group.fieldsWrite(settingsList));
  }

  /**
   * Returns the commit callbacks the groups use, bound to this section.
   *
   * @returns Group host.
   */
  private groupHostCreate(): PanelPropertiesLightGroupHost {
    return {
      settingsCommit: (edit) => this.settingsCommit(edit),
      numericCommit: (input, apply) => this.numericCommit(input, apply),
      switchCommit: (input, apply) => this.switchCommit(input, apply),
    };
  }
}
