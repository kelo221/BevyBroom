import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY,
  EntityVisualTextPlane,
  type EntityVisualTextPlaneOptions,
} from '@/entity/visual/entity_visual_text_plane.js';

/**
 * Returns text plane options with the given room.
 *
 * @param maximumWidth Largest width in meters.
 * @param maximumHeight Largest height in meters.
 * @returns Options.
 */
function optionsOf(maximumWidth: number, maximumHeight: number): EntityVisualTextPlaneOptions {
  return { maximumWidth, maximumHeight, textColorHex: 0xffffff, backColorHex: 0x000000, backOpacity: 0.5 };
}

/**
 * Returns the width and height of a text plane's geometry.
 *
 * @param mesh Text plane.
 * @returns Size in meters.
 */
function sizeOf(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
}

/**
 * Text planes show their text within the room they are given, keeping the
 * text's proportions, and are never picked.
 */
describe('EntityVisualTextPlane', () => {
  it('fits a wide text to the width and a short one to the height', () => {
    const wide = EntityVisualTextPlane.sizeFit(10, optionsOf(2, 1));
    expect(wide.width).toBeCloseTo(2);
    expect(wide.height).toBeCloseTo(0.2);
    const short = EntityVisualTextPlane.sizeFit(2, optionsOf(5, 0.5));
    expect(short.height).toBeCloseTo(0.5);
    expect(short.width).toBeCloseTo(1);
  });

  it('creates a plane holding its text inside the room, wider for longer text', () => {
    const room = optionsOf(4, 0.5);
    const shortPlane = EntityVisualTextPlane.create('Tins', room);
    const longPlane = EntityVisualTextPlane.create('Tins · Cereal · Bottles', room);
    expect(longPlane.userData[ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY]).toBe('Tins · Cereal · Bottles');
    const shortSize = sizeOf(shortPlane);
    const longSize = sizeOf(longPlane);
    expect(longSize.x).toBeGreaterThan(shortSize.x);
    [shortSize, longSize].forEach((size) => {
      expect(size.x).toBeLessThanOrEqual(room.maximumWidth + 1e-9);
      expect(size.y).toBeLessThanOrEqual(room.maximumHeight + 1e-9);
    });
  });

  it('is never hit by a ray', () => {
    const plane = EntityVisualTextPlane.create('Cereal', optionsOf(2, 1));
    const hits: THREE.Intersection[] = [];
    plane.raycast(new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)), hits);
    expect(hits).toEqual([]);
  });
});
