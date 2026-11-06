import type { IconName } from '@/ui/icons/icon_name.js';
import { panelPropertiesSectionHeaderIconWrite } from '@/ui/properties/panel_properties_chrome.js';
import { panelPropertiesGroupRowMark } from '@/ui/properties/panel_properties_row.js';
import type { PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';

/**
 * Look of the inspector sections shown inside the Class Info keyvalue table: no
 * frame of their own, and a header marked as a group row the table styles.
 */
export class ObjectPropertiesClassInfoChromeTable implements PanelPropertiesSectionChrome {
  /**
   * Creates an unframed section container.
   *
   * @returns Section container.
   */
  createSectionContainer(): HTMLElement {
    const section = document.createElement('div');
    section.style.minWidth = '0';
    return section;
  }

  /**
   * Creates the group row that names a section inside the table.
   *
   * @param title Group text.
   * @param iconName Optional icon drawn in front of the text.
   * @returns Group row element.
   */
  createSectionHeader(title: string, iconName?: IconName): HTMLElement {
    const header = document.createElement('div');
    header.className = 'object-properties-keyvalues-group';
    header.textContent = title;
    panelPropertiesGroupRowMark(header);
    if (iconName !== undefined) {
      panelPropertiesSectionHeaderIconWrite(header, iconName);
    }
    return header;
  }
}
