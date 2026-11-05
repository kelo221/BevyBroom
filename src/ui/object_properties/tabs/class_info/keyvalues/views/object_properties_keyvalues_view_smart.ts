import type * as THREE from 'three';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import type { PanelPropertiesSection } from '@/ui/properties/panel_properties_section.js';
import { PanelPropertiesSectionRegistry } from '@/ui/properties/panel_properties_section_registry.js';
import { ObjectPropertiesClassInfoChromeTable } from '../../chrome/object_properties_class_info_chrome_table.js';
import { ObjectPropertiesKeyvalueRawRowList } from '../raw/object_properties_keyvalue_raw_row_list.js';
import { ObjectPropertiesKeyvalueRawSourceAngles } from '../raw/object_properties_keyvalue_raw_source_angles.js';
import { ObjectPropertiesKeyvalueRawSourceName } from '../raw/object_properties_keyvalue_raw_source_name.js';
import { ObjectPropertiesKeyvaluesView } from './object_properties_keyvalues_view.js';

/**
 * Keyvalues with SmartEdit on: the name and angles rows, then the editors of
 * every registered keyvalue section, such as light, room and portal settings
 * and game component fields, pushing onto the dialog's command stack.
 */
export class ObjectPropertiesKeyvaluesViewSmart extends ObjectPropertiesKeyvaluesView {
  private readonly rowList: ObjectPropertiesKeyvalueRawRowList;
  private readonly sections: readonly PanelPropertiesSection[];

  /**
   * Creates the view and its keyvalue sections.
   *
   * @param context Tab context edits are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super();
    this.rowList = new ObjectPropertiesKeyvalueRawRowList(
      [new ObjectPropertiesKeyvalueRawSourceName(context), new ObjectPropertiesKeyvalueRawSourceAngles(context)],
      (row) => row.label,
    );
    this.sections = ObjectPropertiesKeyvaluesViewSmart.keyvalueSectionsCreate(context);
  }

  /**
   * Returns the name and angles rows followed by the section elements.
   *
   * @returns Content elements.
   */
  contentRead(): HTMLElement[] {
    return [this.rowList.getElement(), ...this.sections.map((section) => section.getElement())];
  }

  /**
   * Shows the keyvalues in their editors.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.rowList.refresh(objects);
    this.sections.forEach((section) => section.updateFromObjects(objects));
  }

  /**
   * Creates the registered keyvalue sections with the table look, bound to the
   * dialog's command stack.
   *
   * @param context Tab context.
   * @returns Keyvalue sections in registry order.
   */
  private static keyvalueSectionsCreate(context: ObjectPropertiesTabContext): PanelPropertiesSection[] {
    const sections = PanelPropertiesSectionRegistry.sectionsCreate(new ObjectPropertiesClassInfoChromeTable());
    const keyvalueSections = sections.filter((section) => section.keyvaluesSectionIs?.() === true);
    keyvalueSections.forEach((section) => section.setCommandStack(context.commandStack));
    return keyvalueSections;
  }
}
