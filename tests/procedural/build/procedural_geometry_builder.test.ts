import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProceduralGeometryBuilder } from '@/procedural/build/procedural_geometry_builder.js';
import { ProceduralPartBox } from '@/procedural/build/procedural_part_box.js';

/**
 * Returns the UV span of the triangles facing +Y, the top face of a box.
 *
 * @param geometry Built geometry.
 * @returns Width of the UV range along U and V.
 */
function topFaceUvSpan(geometry: THREE.BufferGeometry): THREE.Vector2 {
  const normals = geometry.getAttribute('normal');
  const uvs = geometry.getAttribute('uv');
  const range = new THREE.Box2();
  for (let index = 0; index < normals.count; index++) {
    if (normals.getY(index) > 0.99) {
      range.expandByPoint(new THREE.Vector2(uvs.getX(index), uvs.getY(index)));
    }
  }
  return range.getSize(new THREE.Vector2());
}

/** Generated parts become flat-shaded geometry with one draw group per part. */
describe('ProceduralGeometryBuilder', () => {
  it('gives every part its own draw group in part order', () => {
    const lower = ProceduralPartBox.create('Lower', 'a', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
    const upper = ProceduralPartBox.create('Upper', 'b', new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 2, 1));
    const geometry = ProceduralGeometryBuilder.create([lower, upper]);
    const trianglesPerBox = 6 * 2;
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1]);
    expect(geometry.groups.map((group) => group.count)).toEqual([trianglesPerBox * 3, trianglesPerBox * 3]);
    expect(geometry.getAttribute('position').count).toBe(trianglesPerBox * 3 * 2);
  });

  it('spans the parts exactly', () => {
    const minimum = new THREE.Vector3(-2, 0.5, 1);
    const maximum = new THREE.Vector3(3, 1.5, 2.5);
    const geometry = ProceduralGeometryBuilder.create([ProceduralPartBox.create('Box', 'a', minimum, maximum)]);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.toArray()).toEqual(minimum.toArray());
    expect(geometry.boundingBox?.max.toArray()).toEqual(maximum.toArray());
  });

  it('keeps the texture size when a part is stretched: UVs grow with the length', () => {
    const short = new THREE.Vector3(1, 1, 1);
    const long = new THREE.Vector3(4, 1, 1);
    const spanOf = (size: THREE.Vector3): THREE.Vector2 =>
      topFaceUvSpan(
        ProceduralGeometryBuilder.create([ProceduralPartBox.create('Box', 'a', new THREE.Vector3(), size)]),
      );
    const shortSpan = spanOf(short);
    const longSpan = spanOf(long);
    expect(longSpan.x * longSpan.y).toBeCloseTo(shortSpan.x * shortSpan.y * (long.x / short.x), 6);
    expect(Math.max(longSpan.x, longSpan.y)).toBeCloseTo(long.x, 6);
  });

  it('skips degenerate faces', () => {
    const point = new THREE.Vector3(1, 2, 3);
    const geometry = ProceduralGeometryBuilder.create([
      { name: 'Flat', materialSlot: 'a', faces: [[point, point.clone(), point.clone()]] },
    ]);
    expect(geometry.getAttribute('position').count).toBe(0);
  });
});
