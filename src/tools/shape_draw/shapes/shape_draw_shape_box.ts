import * as THREE from 'three';

/**
 * Lists the eight corners of an axis-aligned box.
 *
 * @param minimum Inclusive minimum corner.
 * @param maximum Inclusive maximum corner.
 * @returns Corner points of the closed box.
 */
export function shapeDrawShapeBoxPointsCreate(minimum: THREE.Vector3, maximum: THREE.Vector3): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const x of [minimum.x, maximum.x]) {
    for (const y of [minimum.y, maximum.y]) {
      for (const z of [minimum.z, maximum.z]) {
        points.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return points;
}

/**
 * Builds an axis-aligned box piece from per-axis ranges.
 *
 * @param axes Axes the ranges belong to.
 * @param ranges Start and end coordinate per axis, in axis order.
 * @returns Corner points of the closed box.
 */
export function shapeDrawShapeBoxPieceCreate(
  axes: readonly ('x' | 'y' | 'z')[],
  ranges: readonly [number, number][],
): THREE.Vector3[] {
  const minimum = new THREE.Vector3();
  const maximum = new THREE.Vector3();
  for (let index = 0; index < axes.length; index += 1) {
    const axis = axes[index];
    const range = ranges[index];
    if (axis === undefined || range === undefined) {
      continue;
    }
    minimum[axis] = Math.min(range[0], range[1]);
    maximum[axis] = Math.max(range[0], range[1]);
  }
  return shapeDrawShapeBoxPointsCreate(minimum, maximum);
}
