import { describe, expect, it } from 'vitest';
import { ToolbarIcons } from '@/ui/toolbar/toolbar_icons.js';

/**
 * Parses icon markup into its SVG element.
 *
 * @param markup SVG markup.
 * @returns Parsed SVG element, or null.
 */
function toolbarIconsTestSvgParse(markup: string): SVGSVGElement | null {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host.querySelector('svg');
}

describe('ToolbarIcons', () => {
  it('renders every remaining text-coloured icon as a decorative 24 grid SVG', () => {
    const icons = [
      ToolbarIcons.alignFloor(),
      ToolbarIcons.alignWall(),
      ToolbarIcons.alignCeiling(),
      ToolbarIcons.textureReset(),
    ];
    for (const markup of icons) {
      const svg = toolbarIconsTestSvgParse(markup);
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(markup).toContain('currentColor');
    }
  });
});
