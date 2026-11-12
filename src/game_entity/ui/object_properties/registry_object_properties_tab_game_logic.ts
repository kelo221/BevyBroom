import type { ObjectPropertiesTabRegistration } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { objectPropertiesTabAppliesToNonVolumesIs } from '@/ui/object_properties/registry/object_properties_tab_applies_to.js';
import { TabObjectPropertiesInputs } from './inputs/tab_object_properties_inputs.js';
import { TabObjectPropertiesOutputs } from './outputs/tab_object_properties_outputs.js';

/**
 * Returns the entity I/O tabs the game entity feature adds to the Object
 * Properties dialog. They are listed only for selections without modifier
 * volumes, which the game never receives.
 *
 * @returns Outputs and Inputs tab registrations.
 */
export function registryObjectPropertiesTabGameLogicList(): readonly ObjectPropertiesTabRegistration[] {
  return [
    { ...TabObjectPropertiesOutputs.registrationCreate(), appliesToIs: objectPropertiesTabAppliesToNonVolumesIs },
    { ...TabObjectPropertiesInputs.registrationCreate(), appliesToIs: objectPropertiesTabAppliesToNonVolumesIs },
  ];
}
