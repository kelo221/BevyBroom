import type { ObjectPropertiesTabRegistration } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { TabObjectPropertiesInputs } from './inputs/tab_object_properties_inputs.js';
import { TabObjectPropertiesOutputs } from './outputs/tab_object_properties_outputs.js';

/**
 * Returns the entity I/O tabs the game entity feature adds to the Object
 * Properties dialog.
 *
 * @returns Outputs and Inputs tab registrations.
 */
export function registryObjectPropertiesTabGameLogicList(): readonly ObjectPropertiesTabRegistration[] {
  return [TabObjectPropertiesOutputs.registrationCreate(), TabObjectPropertiesInputs.registrationCreate()];
}
