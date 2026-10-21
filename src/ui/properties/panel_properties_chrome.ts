import { Theme } from '@/theme.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { iconSvgElementCreate } from '@/ui/icons/icon_svg.js';
import { hexToRgb } from '@/utils/utils_color.js';
import type { PanelPropertiesSectionChrome } from './panel_properties_section.js';

/** Pixel size of section header icons. */
const PANEL_PROPERTIES_HEADER_ICON_SIZE_PX = 13;

/** Class name of the icon element inside a section header. */
const PANEL_PROPERTIES_HEADER_ICON_CLASS = 'panel-properties-header-icon';

/**
 * Element factories that give every inspector section the properties panel's
 * look: bordered section containers, bold clickable headers and collapsing.
 */
export class PanelPropertiesChrome implements PanelPropertiesSectionChrome {
  /**
   * Creates the outer container element of a section.
   *
   * @returns Styled section container.
   */
  createSectionContainer(): HTMLElement {
    const section = document.createElement('div');
    section.style.padding = '8px';
    section.style.borderBottom = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    return section;
  }

  /**
   * Creates the clickable header element of a section.
   *
   * @param title Header text.
   * @param iconName Optional icon drawn in front of the text.
   * @returns Styled header element.
   */
  createSectionHeader(title: string, iconName?: IconName): HTMLElement {
    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.fontSize = '11px';
    header.style.fontFamily = 'monospace';
    header.style.color = Theme.buttonTextColor;
    header.style.marginBottom = '6px';
    header.style.cursor = 'pointer';
    header.appendChild(document.createTextNode(title));
    if (iconName !== undefined) {
      panelPropertiesSectionHeaderIconWrite(header, iconName);
    }
    return header;
  }

  /**
   * Collapses and expands a section's content when its header is clicked.
   *
   * @param header Header element.
   * @param content Content element that is hidden and shown.
   */
  sectionToggleBind(header: HTMLElement, content: HTMLElement): void {
    let collapsed = false;
    header.addEventListener('click', () => {
      collapsed = !collapsed;
      content.style.display = collapsed ? 'none' : 'block';
    });
  }
}

/**
 * Shows an icon in front of a section header's text, replacing the icon it
 * showed before.
 *
 * @param header Section header element.
 * @param iconName Icon name.
 * @param color CSS icon color; the header text color when omitted.
 */
export function panelPropertiesSectionHeaderIconWrite(header: HTMLElement, iconName: IconName, color?: string): void {
  header.querySelector(`.${PANEL_PROPERTIES_HEADER_ICON_CLASS}`)?.remove();
  const icon = iconSvgElementCreate(document, iconName, PANEL_PROPERTIES_HEADER_ICON_SIZE_PX, color);
  icon.classList.add(PANEL_PROPERTIES_HEADER_ICON_CLASS);
  icon.style.verticalAlign = '-2px';
  icon.style.marginRight = '6px';
  header.prepend(icon);
}
