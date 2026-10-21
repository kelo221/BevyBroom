import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '@/ui/icons/icon_name.js';
import { IconRegistry } from '@/ui/icons/icon_registry.js';
import { iconSvgElementCreate, iconSvgMarkup } from '@/ui/icons/icon_svg.js';

/** Characters SVG path data may contain. */
const SVG_PATH_DATA_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,eE-]+$/;

/** Every icon has drawable path data, and the SVG helpers wrap it. */
describe('IconRegistry', () => {
  it('has path data starting with a move command for every icon name', () => {
    for (const iconName of ICON_NAMES) {
      const pathData = IconRegistry.pathOf(iconName);
      expect(/^[Mm]/.test(pathData), iconName).toBe(true);
      expect(SVG_PATH_DATA_PATTERN.test(pathData), iconName).toBe(true);
    }
  });

  it('builds sized SVG markup that draws the icon path in the requested color', () => {
    const iconName = ICON_NAMES[0];
    const sizePx = 21;
    const host = document.createElement('div');
    host.innerHTML = iconSvgMarkup(iconName, sizePx, '#ff0000');
    const svg = host.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe(String(sizePx));
    expect(svg?.getAttribute('height')).toBe(String(sizePx));
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(IconRegistry.pathOf(iconName));
    expect(svg?.querySelector('path')?.getAttribute('fill')).toBe('#ff0000');
  });

  it('fills with the text color when no color is given', () => {
    const element = iconSvgElementCreate(document, ICON_NAMES[0]);
    expect(element.dataset['icon']).toBe(ICON_NAMES[0]);
    expect(element.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
  });
});
