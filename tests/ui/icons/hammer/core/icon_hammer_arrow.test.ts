import { describe, expect, it } from 'vitest';
import { IconHammerArrow } from '@/ui/icons/hammer/core/icon_hammer_arrow.js';
import { ICON_HAMMER_OUTLINE } from '@/ui/icons/hammer/core/icon_hammer_palette.js';

/**
 * Parses arrow markup inside an SVG root.
 *
 * @param markup Arrow markup.
 * @returns SVG root element.
 */
function iconHammerArrowTestParse(markup: string): SVGSVGElement {
  const host = document.createElement('div');
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
  const svg = host.querySelector('svg');
  if (!svg) {
    throw new Error('Arrow markup did not parse');
  }
  return svg;
}

/**
 * Reads the first corner of every head triangle.
 *
 * @param svg SVG root holding arrows.
 * @returns Tip points as `x,y` text.
 */
function iconHammerArrowTestTips(svg: SVGSVGElement): string[] {
  return [...svg.querySelectorAll('polygon')].map(
    (polygon) => (polygon.getAttribute('points') ?? '').split(' ')[0] ?? '',
  );
}

describe('IconHammerArrow', () => {
  it('points a straight arrow head exactly at the tip with an outlined shaft', () => {
    const tip = { x: 27, y: 9 };
    const svg = iconHammerArrowTestParse(IconHammerArrow.straight({ x: 4, y: 20 }, tip, '#ff0000'));
    expect(iconHammerArrowTestTips(svg)).toEqual([`${tip.x},${tip.y}`]);
    expect(svg.querySelector(`path[stroke="${ICON_HAMMER_OUTLINE}"]`)).not.toBeNull();
  });

  it('puts a head on both tips of a double arrow', () => {
    const start = { x: 3, y: 16 };
    const end = { x: 29, y: 16 };
    const svg = iconHammerArrowTestParse(IconHammerArrow.double(start, end, '#00ff00'));
    expect(iconHammerArrowTestTips(svg)).toEqual([`${start.x},${start.y}`, `${end.x},${end.y}`]);
  });

  it('extends a curved arrow head beyond the shaft end along the direction', () => {
    const shaftEnd = { x: 12, y: 12 };
    const svg = iconHammerArrowTestParse(
      IconHammerArrow.curved('M26 26C26 18 20 12 12 12', shaftEnd, { x: -1, y: 0 }, '#0000ff', 3),
    );
    const [tipX = '', tipY = ''] = (iconHammerArrowTestTips(svg)[0] ?? '').split(',');
    expect(Number(tipX)).toBeLessThan(shaftEnd.x);
    expect(Number(tipY)).toBe(shaftEnd.y);
  });
});
