import type { ObjectPropertiesTabRegistration } from './registry_object_properties_tab.js';
import { registryObjectPropertiesTabGameLogicList } from '@/game_entity/ui/object_properties/registry_object_properties_tab_game_logic.js';
import { TabObjectPropertiesClassInfo } from '@/ui/object_properties/tabs/class_info/tab_object_properties_class_info.js';
import { TabObjectPropertiesModifiers } from '@/ui/object_properties/tabs/modifiers/tab_object_properties_modifiers.js';
import { TabObjectPropertiesProperties } from '@/ui/object_properties/tabs/properties/tab_object_properties_properties.js';
import { TabObjectPropertiesVisGroup } from '@/ui/object_properties/tabs/visgroup/tab_object_properties_visgroup.js';

/**
 * Returns the Object Properties tabs the editor ships with.
 *
 * @returns Tab registrations.
 */
export function registryObjectPropertiesTabBuiltinList(): readonly ObjectPropertiesTabRegistration[] {
  return [
    TabObjectPropertiesClassInfo.registrationCreate(),
    ...registryObjectPropertiesTabGameLogicList(),
    TabObjectPropertiesProperties.registrationCreate(),
    TabObjectPropertiesModifiers.registrationCreate(),
    TabObjectPropertiesVisGroup.registrationCreate(),
  ];
}
