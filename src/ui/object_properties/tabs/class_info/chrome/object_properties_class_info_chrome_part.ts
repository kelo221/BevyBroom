import { Theme } from '@/theme.js';
import type { PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';

/**
 * Look of the parts of the Class Info tab, like Hammer's Object Properties: an
 * unframed block with a small caption such as `Class:` or `Help`.
 */
export class ObjectPropertiesClassInfoChromePart implements PanelPropertiesSectionChrome {
  /**
   * Creates an unframed part container.
   *
   * @returns Part container.
   */
  createSectionContainer(): HTMLElement {
    const part = document.createElement('div');
    part.style.display = 'flex';
    part.style.flexDirection = 'column';
    part.style.gap = '3px';
    part.style.padding = '4px 0';
    part.style.minWidth = '0';
    return part;
  }

  /**
   * Creates the small caption of a part; an empty title gives a hidden caption.
   *
   * @param title Caption text.
   * @returns Caption element.
   */
  createSectionHeader(title: string): HTMLElement {
    const caption = document.createElement('div');
    caption.className = 'object-properties-class-info-caption';
    caption.textContent = title;
    caption.hidden = title === '';
    caption.style.color = Theme.statusBarTextColor;
    caption.style.fontFamily = Theme.uiFontFamily;
    caption.style.fontSize = '11px';
    return caption;
  }
}
