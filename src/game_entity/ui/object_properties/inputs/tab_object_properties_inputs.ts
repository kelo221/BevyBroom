import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSectioned } from '@/ui/object_properties/tabs/object_properties_tab_sectioned.js';
import { ObjectPropertiesLogicInputsSectionTable } from './object_properties_logic_inputs_section_table.js';

/**
 * Inputs tab of the Object Properties dialog: the read-only list of the entity
 * I/O connections other objects fire at the edited object.
 */
export class TabObjectPropertiesInputs extends ObjectPropertiesTabSectioned {
  /**
   * Builds the inputs table into the tab container.
   *
   * @param context Tab context used to read the scene and mark sources.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context.container, [new ObjectPropertiesLogicInputsSectionTable(context)]);
  }

  /**
   * Returns the registration of the Inputs tab.
   *
   * @returns Tab registration.
   */
  static registrationCreate(): ObjectPropertiesTabRegistration {
    return {
      id: 'inputs',
      label: 'Inputs',
      order: 30,
      mount: (context) => new TabObjectPropertiesInputs(context),
    };
  }
}
