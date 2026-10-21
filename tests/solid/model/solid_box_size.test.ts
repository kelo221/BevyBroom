import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { solidBoxSizeLongestEdge, solidBoxSizeVectorResolve } from '@/solid/model/solid_box_size.js';

/**
 * Proves box brush sizes resolve the same way from a cube edge or per-axis
 * lengths.
 */
describe('solid box size', () => {
  it('expands a cube edge to equal width, height and depth', () => {
    const edge = 3.25;
    expect(solidBoxSizeVectorResolve(edge).toArray()).toEqual([edge, edge, edge]);
  });

  it('returns a copy of per-axis sizes that does not alias the input', () => {
    const size = new THREE.Vector3(1, 2, 3);
    const resolved = solidBoxSizeVectorResolve(size);
    expect(resolved.equals(size)).toBe(true);
    resolved.x = 99;
    expect(size.x).toBe(1);
  });

  it('reports the longest edge of either form', () => {
    const size = new THREE.Vector3(0.5, 7, 2);
    expect(solidBoxSizeLongestEdge(size)).toBe(size.y);
    expect(solidBoxSizeLongestEdge(4)).toBe(4);
  });
});
