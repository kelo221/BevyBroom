import type * as THREE from 'three';
import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSectioned } from '@/ui/object_properties/tabs/object_properties_tab_sectioned.js';
import { ObjectPropertiesLogicOutputsModel } from './object_properties_logic_outputs_model.js';
import { ObjectPropertiesLogicOutputsSectionEditor } from './object_properties_logic_outputs_section_editor.js';
import { ObjectPropertiesLogicOutputsSectionTable } from './object_properties_logic_outputs_section_table.js';

/**
 * Outputs tab of the Object Properties dialog: the entity I/O connections the
 * edited object fires, with target validation and a row editor.
 */
export class TabObjectPropertiesOutputs extends ObjectPropertiesTabSectioned {
  private readonly model: ObjectPropertiesLogicOutputsModel;
  private editedObjects: readonly THREE.Object3D[];

  /**
   * Builds the table and row editor into the tab container.
   *
   * @param context Tab context the connection edits are pushed through.
   * @param model Outputs state shared by the sections.
   */
  constructor(context: ObjectPropertiesTabContext, model: ObjectPropertiesLogicOutputsModel) {
    super(context.container, [
      new ObjectPropertiesLogicOutputsSectionTable(context, model),
      new ObjectPropertiesLogicOutputsSectionEditor(context, model),
    ]);
    this.model = model;
    this.editedObjects = [];
    model.changeListenerWrite(() => this.refresh(this.editedObjects));
  }

  /**
   * Shows the outputs of the edited object.
   *
   * @param selectedObjects Edited objects.
   */
  override refresh(selectedObjects: readonly THREE.Object3D[]): void {
    this.editedObjects = selectedObjects;
    this.model.sourceWrite(selectedObjects);
    super.refresh(selectedObjects);
  }

  /**
   * Returns the registration of the Outputs tab.
   *
   * @returns Tab registration.
   */
  static registrationCreate(): ObjectPropertiesTabRegistration {
    return {
      id: 'outputs',
      label: 'Outputs',
      order: 20,
      mount: (context) => new TabObjectPropertiesOutputs(context, new ObjectPropertiesLogicOutputsModel(context)),
    };
  }
}
