import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityArrayLayout } from '@/entity_array/layout/entity_array_layout.js';
import { EntityArraySettingsRules } from '@/entity_array/model/entity_array_settings.js';

/**
 * Returns settings with counts and gaps.
 *
 * @param counts Objects along X, Y and Z.
 * @param gap Gaps along X, Y and Z.
 * @returns Valid settings.
 */
function settingsOf(counts: [number, number, number], gap: [number, number, number]) {
  const settings = EntityArraySettingsRules.fromUnknown({
    count_x: counts[0],
    count_y: counts[1],
    count_z: counts[2],
    gap,
  });
  if (settings === null) {
    throw new Error('array settings are an object');
  }
  return settings;
}

/**
 * The layout fills every cell but the source's own, one footprint plus one gap
 * apart.
 */
describe('EntityArrayLayout', () => {
  it('leaves out the source cell and fills every other cell once', () => {
    const counts: [number, number, number] = [3, 2, 4];
    const cells = EntityArrayLayout.cellsOf(settingsOf(counts, [0, 0, 0]), new THREE.Vector3(1, 1, 1));
    expect(cells).toHaveLength(counts[0] * counts[1] * counts[2] - 1);
    const keys = new Set(cells.map((cell) => cell.cell.join()));
    expect(keys.size).toBe(cells.length);
    expect(keys.has('0,0,0')).toBe(false);
  });

  it('spaces cells by the footprint plus the gap on each axis', () => {
    const footprint = new THREE.Vector3(2, 0.75, 1.25);
    const gap: [number, number, number] = [0.5, 0, 0.25];
    const settings = settingsOf([3, 2, 2], gap);
    const step = EntityArrayLayout.stepOf(settings, footprint);
    expect(step.toArray()).toEqual([footprint.x + gap[0], footprint.y + gap[1], footprint.z + gap[2]]);
    for (const cell of EntityArrayLayout.cellsOf(settings, footprint)) {
      const expected = new THREE.Vector3(cell.cell[0] * step.x, cell.cell[1] * step.y, cell.cell[2] * step.z);
      expect(cell.offset.distanceTo(expected)).toBeCloseTo(0, 12);
    }
  });

  it('uses the gap alone as the step of an entity without a footprint', () => {
    const settings = settingsOf([3, 1, 1], [1.5, 0, 0]);
    const cells = EntityArrayLayout.cellsOf(settings, new THREE.Vector3());
    expect(cells.map((cell) => cell.offset.x)).toEqual([1.5, 3]);
  });

  it('lists cells in the same order every time', () => {
    const settings = settingsOf([2, 2, 2], [0.1, 0.2, 0.3]);
    const footprint = new THREE.Vector3(1, 2, 3);
    const first = EntityArrayLayout.cellsOf(settings, footprint).map((cell) => cell.cell.join());
    const second = EntityArrayLayout.cellsOf(settings, footprint).map((cell) => cell.cell.join());
    expect(second).toEqual(first);
  });
});
