import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ViewportObjectWireColor } from '@/viewports/shading/viewport_object_wire_color.js';

/** Number of generated ids the spread tests hash. */
const WIRE_COLOR_SAMPLE_COUNT = 600;

/**
 * Generates fresh random uuids.
 *
 * @param count Number of ids.
 * @returns Distinct uuid strings.
 */
function wireColorSampleIdsCreate(count: number): string[] {
  return Array.from({ length: count }, () => THREE.MathUtils.generateUUID());
}

/** Unit tests for the stable per-object 2D wire colors. */
describe('ViewportObjectWireColor', () => {
  it('returns the same palette color for the same id every time', () => {
    wireColorSampleIdsCreate(20).forEach((id) => {
      const first = ViewportObjectWireColor.colorFromId(id);
      expect(ViewportObjectWireColor.colorFromId(String(id))).toBe(first);
      expect(Theme.objectWirePalette).toContain(first);
    });
  });

  it('hashes to an unsigned 32-bit integer', () => {
    wireColorSampleIdsCreate(20).forEach((id) => {
      const hash = ViewportObjectWireColor.idHash(id);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    });
  });

  it('spreads many ids over every palette slot without one slot dominating', () => {
    const slotCounts = new Array<number>(Theme.objectWirePalette.length).fill(0);
    wireColorSampleIdsCreate(WIRE_COLOR_SAMPLE_COUNT).forEach((id) => {
      const slot = ViewportObjectWireColor.paletteIndexFromId(id);
      slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
    });
    const fairShare = WIRE_COLOR_SAMPLE_COUNT / Theme.objectWirePalette.length;
    slotCounts.forEach((count) => expect(count).toBeGreaterThan(0));
    expect(Math.max(...slotCounts)).toBeLessThan(fairShare * 3);
  });

  it('gives most neighbouring ids different colors', () => {
    const colors = wireColorSampleIdsCreate(100).map((id) => ViewportObjectWireColor.colorFromId(id));
    expect(new Set(colors).size).toBeGreaterThan(Theme.objectWirePalette.length / 2);
  });

  it('uses the selection color while selected and the palette color otherwise', () => {
    const [id = ''] = wireColorSampleIdsCreate(1);
    expect(ViewportObjectWireColor.colorResolve(id, true)).toBe(Theme.selectionColor);
    expect(ViewportObjectWireColor.colorResolve(id, false)).toBe(ViewportObjectWireColor.colorFromId(id));
  });

  it('maps every palette index to its palette color', () => {
    Theme.objectWirePalette.forEach((color, index) => {
      expect(ViewportObjectWireColor.colorFromPaletteIndex(index)).toBe(color);
    });
  });
});
