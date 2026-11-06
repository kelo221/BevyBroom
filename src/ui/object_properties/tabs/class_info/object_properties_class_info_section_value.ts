import type * as THREE from 'three';
import { InputText } from '@/ui/input/input_text.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';
import type { ObjectPropertiesKeyvalueRowSelection } from './keyvalues/object_properties_keyvalue_row_selection.js';

/**
 * Value part of the Class Info tab: an edit box with the value of the row
 * selected in the keyvalue table. Committing it edits that row's value.
 */
export class ObjectPropertiesClassInfoSectionValue extends ObjectPropertiesTabSection {
  private readonly keyCaption: HTMLElement;
  private readonly valueInput: InputText;
  private selection: ObjectPropertiesKeyvalueRowSelection | null;

  /**
   * Creates the value part with no selected row.
   *
   * @param context Tab context.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context, '', new ObjectPropertiesClassInfoChromePart());
    this.selection = null;
    this.keyCaption = new ObjectPropertiesClassInfoChromePart().createSectionHeader('Value:');
    this.valueInput = new InputText('Selected value');
    this.valueInput.bindCommit(() => this.selection?.valueWrite(this.valueInput.getValue()));
    this.element.append(this.keyCaption, this.valueInput.getElement());
    this.selectionWrite(null);
  }

  /**
   * Shows the value of the selected row again after the objects changed.
   *
   * @param _objects Edited objects.
   */
  refresh(_objects: readonly THREE.Object3D[]): void {
    this.valueShow();
  }

  /**
   * Shows another selected row.
   *
   * @param selection Selected row, or null.
   */
  selectionWrite(selection: ObjectPropertiesKeyvalueRowSelection | null): void {
    this.selection = selection;
    this.keyCaption.textContent = selection ? `${selection.captionRead()}:` : 'Value:';
    this.valueInput.getElement().disabled = selection === null;
    this.valueShow();
  }

  /** Shows the selected row's value, or an empty box without a selection. */
  private valueShow(): void {
    this.valueInput.setSharedValues([this.selection?.valueRead() ?? '']);
  }
}
