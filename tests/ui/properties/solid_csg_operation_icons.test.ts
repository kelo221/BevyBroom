import { describe, it, expect } from 'vitest';
import { SolidCsgOperationIcons } from '@/ui/properties/solid_csg_operation_icons.js';
import { Theme } from '@/theme.js';

describe('SolidCsgOperationIcons', () => {
  it('returns SVG markup for additive, subtractive, and intersecting', () => {
    for (const markup of [
      SolidCsgOperationIcons.additive(),
      SolidCsgOperationIcons.subtractive(),
      SolidCsgOperationIcons.intersecting(),
    ]) {
      expect(markup.startsWith('<svg')).toBe(true);
      expect(markup).toContain('viewBox="0 0 18 18"');
      expect(markup).toContain('aria-hidden="true"');
    }
  });

  it('draws two filled squares with outlines for additive', () => {
    const markup = SolidCsgOperationIcons.additive();
    expect(countFilledRects(markup)).toBe(2);
    expect(countOutlineRects(markup)).toBe(2);
    expect(markup).not.toContain(Theme.panelSunkenBackground);
    expect(markup).toContain('fill="currentColor"');
  });

  it('keeps the front square empty for subtractive', () => {
    const markup = SolidCsgOperationIcons.subtractive();
    expect(markup).toContain(Theme.panelSunkenBackground);
    expect(countFilledRects(markup)).toBe(2);
    expect(countOutlineRects(markup)).toBe(2);
  });

  it('lights only the overlap for intersecting and empties the exclusive parts', () => {
    const markup = SolidCsgOperationIcons.intersecting();
    expect(markup).toContain(Theme.panelSunkenBackground);
    expect(markup).toContain('fill="currentColor"');
    expect(countEmptyPaths(markup)).toBe(2);
    expect(countFilledRects(markup)).toBe(1);
    expect(countOutlineRects(markup)).toBe(2);
  });
});

/**
 * Counts filled rectangle elements in icon SVG markup.
 *
 * @param markup SVG markup string.
 * @returns Number of filled rect elements.
 */
function countFilledRects(markup: string): number {
  const matches = markup.match(/<rect[^>]*fill="(?!none)[^"]*"/g);
  return matches?.length ?? 0;
}

/**
 * Counts outline-only rectangle elements in icon SVG markup.
 *
 * @param markup SVG markup string.
 * @returns Number of stroke-only rect elements.
 */
function countOutlineRects(markup: string): number {
  const matches = markup.match(/<rect[^>]*fill="none"/g);
  return matches?.length ?? 0;
}

/**
 * Counts empty-filled path elements used for exclusive regions.
 *
 * @param markup SVG markup string.
 * @returns Number of empty-filled path elements.
 */
function countEmptyPaths(markup: string): number {
  return markup.split(`<path fill="${Theme.panelSunkenBackground}"`).length - 1;
}
