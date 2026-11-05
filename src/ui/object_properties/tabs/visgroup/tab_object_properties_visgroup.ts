import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSectioned } from '@/ui/object_properties/tabs/object_properties_tab_sectioned.js';
import type { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { getVisGroupSharedServices } from '@/visgroup/visgroup_shared_services.js';
import { ObjectPropertiesVisGroupSectionMembership } from './object_properties_visgroup_section_membership.js';

/**
 * VisGroup tab of the Object Properties dialog: membership of the edited
 * objects.
 */
export class TabObjectPropertiesVisGroup extends ObjectPropertiesTabSectioned {
  /**
   * Builds the membership section into the tab container.
   *
   * @param context Tab context the membership edits are pushed through.
   * @param store VisGroup store whose user groups are listed.
   */
  constructor(context: ObjectPropertiesTabContext, store: VisGroupStore) {
    super(context.container, [new ObjectPropertiesVisGroupSectionMembership(context, store)]);
  }

  /**
   * Returns the registration of the VisGroup tab over the editor's shared
   * VisGroup store.
   *
   * @returns Tab registration.
   */
  static registrationCreate(): ObjectPropertiesTabRegistration {
    return {
      id: 'visgroup',
      label: 'VisGroup',
      order: 50,
      mount: (context) => new TabObjectPropertiesVisGroup(context, getVisGroupSharedServices().visGroupStore),
    };
  }
}
