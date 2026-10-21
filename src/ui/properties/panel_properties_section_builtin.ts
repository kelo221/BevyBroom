import { PanelPropertiesGameComponentsSection } from '@/game_entity/ui/panel_properties_game_components_section.js';
import type { PanelPropertiesSectionFactory } from '@/ui/properties/panel_properties_section.js';
import { PanelPropertiesBevelVolumeSection } from '@/ui/properties/panel_properties_bevel_volume_section.js';
import { PanelPropertiesLightSection } from '@/ui/properties/panel_properties_light_section.js';
import { PanelPropertiesPortalSection } from '@/ui/properties/panel_properties_portal_section.js';
import { PanelPropertiesRoomSection } from '@/ui/properties/panel_properties_room_section.js';

/**
 * Returns the factories of the inspector sections the editor ships with, in
 * display order.
 *
 * @returns Section factories.
 */
export function panelPropertiesSectionFactoriesBuiltin(): readonly PanelPropertiesSectionFactory[] {
  return [
    (chrome) => new PanelPropertiesBevelVolumeSection(chrome.createSectionContainer, chrome.createSectionHeader),
    (chrome) => new PanelPropertiesLightSection(chrome.createSectionContainer, chrome.createSectionHeader),
    (chrome) => new PanelPropertiesRoomSection(chrome.createSectionContainer, chrome.createSectionHeader),
    (chrome) => new PanelPropertiesPortalSection(chrome.createSectionContainer, chrome.createSectionHeader),
    (chrome) => new PanelPropertiesGameComponentsSection(chrome),
  ];
}
