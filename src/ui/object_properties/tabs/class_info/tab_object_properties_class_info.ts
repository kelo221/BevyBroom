import type * as THREE from 'three';
import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabInstance,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import type { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { ObjectPropertiesTabSectioned } from '@/ui/object_properties/tabs/object_properties_tab_sectioned.js';
import type { ObjectPropertiesKeyvalueRowSelection } from './keyvalues/object_properties_keyvalue_row_selection.js';
import { ObjectPropertiesClassInfoSectionAngles } from './object_properties_class_info_section_angles.js';
import { ObjectPropertiesClassInfoSectionClass } from './object_properties_class_info_section_class.js';
import { ObjectPropertiesClassInfoSectionComments } from './object_properties_class_info_section_comments.js';
import { ObjectPropertiesClassInfoSectionHelp } from './object_properties_class_info_section_help.js';
import { ObjectPropertiesClassInfoSectionKeyvalues } from './object_properties_class_info_section_keyvalues.js';
import { ObjectPropertiesClassInfoSectionToggles } from './object_properties_class_info_section_toggles.js';
import { ObjectPropertiesClassInfoSectionValue } from './object_properties_class_info_section_value.js';

/** Width of the right column of the Class Info tab. */
const CLASS_INFO_RIGHT_COLUMN_WIDTH = '230px';

/** Narrowest width of the left column before the right column wraps below it. */
const CLASS_INFO_LEFT_COLUMN_MINIMUM_WIDTH = '260px';

/**
 * Class Info tab of the Object Properties dialog, laid out like Hammer's: the
 * Class combo and the keyvalue table on the left; the SmartEdit and Help
 * toggles, angles with Point At, the selected value, the help box and the
 * comments on the right.
 */
export class TabObjectPropertiesClassInfo implements ObjectPropertiesTabInstance {
  private readonly keyvalues: ObjectPropertiesClassInfoSectionKeyvalues;
  private readonly value: ObjectPropertiesClassInfoSectionValue;
  private readonly help: ObjectPropertiesClassInfoSectionHelp;
  private readonly leftColumn: ObjectPropertiesTabSectioned;
  private readonly rightColumn: ObjectPropertiesTabSectioned;

  /**
   * Builds the two columns into the tab container.
   *
   * @param context Tab context the parts edit through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    this.value = new ObjectPropertiesClassInfoSectionValue(context);
    this.help = new ObjectPropertiesClassInfoSectionHelp(context);
    this.keyvalues = new ObjectPropertiesClassInfoSectionKeyvalues(context, (selection) =>
      this.rowSelectionShow(selection),
    );
    const [leftElement, rightElement] = TabObjectPropertiesClassInfo.columnsCreate(context.container);
    this.leftColumn = new ObjectPropertiesTabSectioned(leftElement, [
      new ObjectPropertiesClassInfoSectionClass(context),
      this.keyvalues,
    ]);
    this.rightColumn = new ObjectPropertiesTabSectioned(rightElement, this.rightSectionsCreate(context));
  }

  /**
   * Refreshes the table first, then the parts that read the selected row.
   *
   * @param selectedObjects Edited objects.
   */
  refresh(selectedObjects: readonly THREE.Object3D[]): void {
    this.leftColumn.refresh(selectedObjects);
    this.rightColumn.refresh(selectedObjects);
  }

  /** Disposes every part. */
  dispose(): void {
    this.leftColumn.dispose();
    this.rightColumn.dispose();
  }

  /**
   * Returns the registration of the Class Info tab.
   *
   * @returns Tab registration.
   */
  static registrationCreate(): ObjectPropertiesTabRegistration {
    return {
      id: 'class_info',
      label: 'Class Info',
      order: 10,
      mount: (context) => new TabObjectPropertiesClassInfo(context),
    };
  }

  /**
   * Creates the parts of the right column in display order.
   *
   * @param context Tab context the parts edit through.
   * @returns Right column parts.
   */
  private rightSectionsCreate(context: ObjectPropertiesTabContext): ObjectPropertiesTabSection[] {
    return [
      new ObjectPropertiesClassInfoSectionToggles(context, {
        smartEditWrite: (isSmartEdit) => this.keyvalues.smartEditWrite(isSmartEdit),
        helpVisibleWrite: (isVisible) => this.help.visibleWrite(isVisible),
      }),
      new ObjectPropertiesClassInfoSectionAngles(context),
      this.value,
      this.help,
      new ObjectPropertiesClassInfoSectionComments(context),
    ];
  }

  /**
   * Shows the selected keyvalue in the value box and the help box.
   *
   * @param selection Selected row, or null.
   */
  private rowSelectionShow(selection: ObjectPropertiesKeyvalueRowSelection | null): void {
    this.value.selectionWrite(selection);
    this.help.selectionWrite(selection);
  }

  /**
   * Builds the wide left column and the right column in the container. When the
   * container is too narrow for both side by side, the right column wraps below
   * the left one and takes the full width.
   *
   * @param container Tab page element.
   * @returns Left and right column elements.
   */
  private static columnsCreate(container: HTMLElement): [HTMLElement, HTMLElement] {
    const columns = document.createElement('div');
    columns.className = 'object-properties-class-info-columns';
    columns.style.cssText = 'display:flex;flex-wrap:wrap;flex:1 1 auto;min-height:0;gap:12px;padding:8px 10px;';
    const left = document.createElement('div');
    left.className = 'object-properties-class-info-column-left';
    left.style.cssText = `display:flex;flex-direction:column;flex:999 1 ${CLASS_INFO_LEFT_COLUMN_MINIMUM_WIDTH};min-width:0;`;
    const right = document.createElement('div');
    right.className = 'object-properties-class-info-column-right';
    right.style.cssText = `display:flex;flex-direction:column;flex:1 1 ${CLASS_INFO_RIGHT_COLUMN_WIDTH};min-width:0;`;
    columns.append(left, right);
    container.appendChild(columns);
    return [left, right];
  }
}
