import type * as THREE from 'three';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesKeyvalueRawRowList } from '../raw/object_properties_keyvalue_raw_row_list.js';
import { ObjectPropertiesKeyvalueRawSourceAngles } from '../raw/object_properties_keyvalue_raw_source_angles.js';
import { ObjectPropertiesKeyvalueRawSourceEntitySettings } from '../raw/object_properties_keyvalue_raw_source_entity_settings.js';
import { ObjectPropertiesKeyvalueRawSourceGameComponents } from '../raw/object_properties_keyvalue_raw_source_game_components.js';
import { ObjectPropertiesKeyvalueRawSourceName } from '../raw/object_properties_keyvalue_raw_source_name.js';
import { ObjectPropertiesKeyvaluesView } from './object_properties_keyvalues_view.js';

/**
 * Keyvalues with SmartEdit off: every key with its value as plain text, the
 * name, angles, entity settings and game component fields alike.
 */
export class ObjectPropertiesKeyvaluesViewRaw extends ObjectPropertiesKeyvaluesView {
  private readonly rowList: ObjectPropertiesKeyvalueRawRowList;

  /**
   * Creates the view.
   *
   * @param context Tab context edits are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super();
    this.rowList = new ObjectPropertiesKeyvalueRawRowList(
      [
        new ObjectPropertiesKeyvalueRawSourceName(context),
        new ObjectPropertiesKeyvalueRawSourceAngles(context),
        new ObjectPropertiesKeyvalueRawSourceEntitySettings(context),
        new ObjectPropertiesKeyvalueRawSourceGameComponents(context),
      ],
      (row) => row.label,
    );
  }

  /**
   * Returns the text rows.
   *
   * @returns The row list element.
   */
  contentRead(): HTMLElement[] {
    return [this.rowList.getElement()];
  }

  /**
   * Shows the keyvalues as text.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.rowList.refresh(objects);
  }
}
