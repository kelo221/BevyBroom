import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityVisualHatchPlane } from '@/entity/visual/entity_visual_hatch_plane.js';

/**
 * Returns the largest texture coordinate of a plane along each axis.
 *
 * @param mesh Hatch plane.
 * @returns Largest U and V.
 */
function uvMaximumOf(mesh: THREE.Mesh): THREE.Vector2 {
  const uv = mesh.geometry.getAttribute('uv');
  const maximum = new THREE.Vector2(-Infinity, -Infinity);
  for (let index = 0; index < uv.count; index += 1) {
    maximum.set(Math.max(maximum.x, uv.getX(index)), Math.max(maximum.y, uv.getY(index)));
  }
  return maximum;
}

/**
 * Hatch planes repeat one shared diagonal stripe tile at the given spacing and
 * are never picked.
 */
describe('EntityVisualHatchPlane', () => {
  it('repeats the stripe tile once per stripe spacing along each side', () => {
    const width = 6;
    const height = 1.5;
    const spacing = 0.5;
    const plane = EntityVisualHatchPlane.create(width, height, spacing, 0x101010);
    const maximum = uvMaximumOf(plane);
    expect(maximum.x).toBeCloseTo(width / spacing);
    expect(maximum.y).toBeCloseTo(height / spacing);
  });

  it('shares one repeating tile with clear gaps between opaque stripes', () => {
    const first = EntityVisualHatchPlane.create(1, 1, 0.25, 0x101010);
    const second = EntityVisualHatchPlane.create(2, 1, 0.25, 0x101010);
    const tile = EntityVisualHatchPlane.stripeTextureShared();
    expect((first.material as THREE.MeshBasicMaterial).map).toBe(tile);
    expect((second.material as THREE.MeshBasicMaterial).map).toBe(tile);
    expect(tile.wrapS).toBe(THREE.RepeatWrapping);
    const alphas = new Set<number>();
    const pixels = tile.image.data as Uint8Array;
    for (let index = 3; index < pixels.length; index += 4) {
      alphas.add(pixels[index] ?? -1);
    }
    expect([...alphas].sort((a, b) => a - b)).toEqual([0, 255]);
  });

  it('is never hit by a ray', () => {
    const plane = EntityVisualHatchPlane.create(1, 1, 0.25, 0x101010);
    const hits: THREE.Intersection[] = [];
    plane.raycast(new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)), hits);
    expect(hits).toEqual([]);
  });
});
