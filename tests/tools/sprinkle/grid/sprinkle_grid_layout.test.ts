import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SprinkleGridLayout } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import { SprinkleGridPlane } from '@/tools/sprinkle/grid/sprinkle_grid_plane.js';
import { StateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_GRID_SIZE_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import { sprinkleTestDefinitionCreate } from '../sprinkle_test_support.js';

/**
 * Sprinkle grid cell keys, centers, offsets and the size the configuration
 * picks.
 */
describe('SprinkleGridLayout', () => {
  const plane = new SprinkleGridPlane('y');

  it('maps every point near a cell center to that cell', () => {
    const layout = new SprinkleGridLayout(0.75, 1.25, 0, 0);
    const cell = layout.cellAt(plane, 3, -2);
    const center = plane.pointCompose(cell.centerU, cell.centerV, 5);
    const nudge = new THREE.Vector3(layout.sizeU * 0.4, 0, -layout.sizeV * 0.4);
    expect(layout.cellOf(plane, center).key).toBe(cell.key);
    expect(layout.cellOf(plane, center.clone().add(nudge)).key).toBe(cell.key);
  });

  it('gives different planes different keys for the same indices', () => {
    const layout = new SprinkleGridLayout(1, 1, 0, 0);
    expect(layout.cellAt(new SprinkleGridPlane('x'), 1, 1).key).not.toBe(layout.cellAt(plane, 1, 1).key);
  });

  it('shifts cell centers by the grid offset', () => {
    const plain = new SprinkleGridLayout(2, 2, 0, 0);
    const shifted = new SprinkleGridLayout(2, 2, 0.5, -0.25);
    const plainCell = plain.cellAt(plane, 4, 7);
    const shiftedCell = shifted.cellAt(plane, 4, 7);
    expect(shiftedCell.centerU - plainCell.centerU).toBeCloseTo(shifted.offsetU, 12);
    expect(shiftedCell.centerV - plainCell.centerV).toBeCloseTo(shifted.offsetV, 12);
  });

  it('raises sizes below the smallest grid size', () => {
    const layout = new SprinkleGridLayout(0, -1, 0, 0);
    expect([layout.sizeU, layout.sizeV]).toEqual([SPRINKLE_GRID_SIZE_MIN, SPRINKLE_GRID_SIZE_MIN]);
  });

  it('takes the definition grid only when asked and present', () => {
    const config = { ...StateSprinkleTool.configDefaultCreate(), gridSizeU: 3, gridSizeV: 5 };
    const definition = sprinkleTestDefinitionCreate(undefined, 0.5);
    const fromDefinition = SprinkleGridLayout.fromConfig({ ...config, gridSizeFromDefinition: true }, definition);
    const custom = SprinkleGridLayout.fromConfig({ ...config, gridSizeFromDefinition: false }, definition);
    const withoutGrid = SprinkleGridLayout.fromConfig(config, sprinkleTestDefinitionCreate(undefined, null));
    expect([fromDefinition.sizeU, fromDefinition.sizeV]).toEqual([0.5, 0.5]);
    expect([custom.sizeU, custom.sizeV]).toEqual([config.gridSizeU, config.gridSizeV]);
    expect([withoutGrid.sizeU, withoutGrid.sizeV]).toEqual([config.gridSizeU, config.gridSizeV]);
  });
});
