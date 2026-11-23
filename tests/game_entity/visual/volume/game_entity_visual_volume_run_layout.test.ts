import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityVisualVolumeRunLayout } from '@/game_entity/visual/volume/game_entity_visual_volume_run_layout.js';

/**
 * Returns bounds of the given size whose corner sits at an arbitrary offset, so
 * the rule is proven away from the origin too.
 *
 * @param size Edge lengths.
 * @returns Local bounds.
 */
function boundsOfSize(size: THREE.Vector3): THREE.Box3 {
  const corner = new THREE.Vector3(-1.25, 0.5, 3.75);
  return new THREE.Box3(corner.clone(), corner.clone().add(size));
}

/** Unit scale. */
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

/**
 * The run rule Cart Crashers stocks by: runs follow the longer local horizontal
 * axis (X on a tie), split it into equal bands and start at its negative end.
 */
describe('GameEntityVisualVolumeRunLayout', () => {
  it('runs along local X when the X extent is longer than the Z extent', () => {
    expect(GameEntityVisualVolumeRunLayout.axisOf(boundsOfSize(new THREE.Vector3(6, 2, 2)), UNIT_SCALE)).toBe('x');
  });

  it('runs along local Z when the Z extent is longer than the X extent', () => {
    expect(GameEntityVisualVolumeRunLayout.axisOf(boundsOfSize(new THREE.Vector3(2, 9, 6)), UNIT_SCALE)).toBe('z');
  });

  it('runs along local X when both horizontal extents are equal, whatever the height', () => {
    expect(GameEntityVisualVolumeRunLayout.axisOf(boundsOfSize(new THREE.Vector3(4, 20, 4)), UNIT_SCALE)).toBe('x');
  });

  it('measures the extents with the local scale applied', () => {
    const bounds = boundsOfSize(new THREE.Vector3(4, 1, 3));
    expect(GameEntityVisualVolumeRunLayout.axisOf(bounds, new THREE.Vector3(1, 1, 2))).toBe('z');
    expect(GameEntityVisualVolumeRunLayout.axisOf(bounds, new THREE.Vector3(-1, 1, 1))).toBe('x');
  });

  it('splits the run axis into equal contiguous bands in list order from its negative end', () => {
    const bounds = boundsOfSize(new THREE.Vector3(3, 1, 7));
    const layout = GameEntityVisualVolumeRunLayout.layoutOf(bounds, UNIT_SCALE, 3);
    const expectedLength = (bounds.max.z - bounds.min.z) / 3;
    expect(layout.axis).toBe('z');
    expect(layout.bands.map((band) => band.index)).toEqual([0, 1, 2]);
    expect(layout.bands[0]?.start).toBeCloseTo(bounds.min.z);
    expect(layout.bands[2]?.end).toBeCloseTo(bounds.max.z);
    layout.bands.forEach((band, index) => {
      expect(band.end - band.start).toBeCloseTo(expectedLength);
      expect(band.start).toBeCloseTo(layout.bands[index - 1]?.end ?? bounds.min.z);
    });
  });

  it('gives one band covering the whole axis for one run and none for no runs', () => {
    const bounds = boundsOfSize(new THREE.Vector3(5, 1, 2));
    const single = GameEntityVisualVolumeRunLayout.layoutOf(bounds, UNIT_SCALE, 1);
    expect(single.bands).toHaveLength(1);
    expect(single.bands[0]?.start).toBeCloseTo(bounds.min.x);
    expect(single.bands[0]?.end).toBeCloseTo(bounds.max.x);
    expect(GameEntityVisualVolumeRunLayout.layoutOf(bounds, UNIT_SCALE, 0).bands).toEqual([]);
  });
});
