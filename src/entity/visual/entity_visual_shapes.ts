import * as THREE from 'three';

/** Line segments drawn per guide circle. */
const ENTITY_VISUAL_CIRCLE_SEGMENTS = 48;

/**
 * Corner index pairs of the twelve edges of a box; bit 0 is +X, bit 1 +Y, bit 2
 * +Z.
 */
const ENTITY_VISUAL_BOX_EDGE_CORNER_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/**
 * Appends guide line shapes to segment endpoint lists: circles, box edges and
 * spokes from an apex to a ring.
 */
export class EntityVisualShapes {
  /**
   * Appends a circle as segment endpoint pairs.
   *
   * @param points Output endpoint list.
   * @param center Circle center.
   * @param first First in-plane axis (unit).
   * @param second Second in-plane axis (unit).
   * @param radius Circle radius.
   */
  static circleAppend(
    points: THREE.Vector3[],
    center: THREE.Vector3,
    first: THREE.Vector3,
    second: THREE.Vector3,
    radius: number,
  ): void {
    const pointAt = (step: number): THREE.Vector3 => {
      const angle = (step / ENTITY_VISUAL_CIRCLE_SEGMENTS) * Math.PI * 2;
      return center
        .clone()
        .addScaledVector(first, Math.cos(angle) * radius)
        .addScaledVector(second, Math.sin(angle) * radius);
    };
    for (let step = 0; step < ENTITY_VISUAL_CIRCLE_SEGMENTS; step++) {
      points.push(pointAt(step), pointAt(step + 1));
    }
  }

  /**
   * Appends lines from an apex to evenly spaced points on a ring.
   *
   * @param points Output endpoint list.
   * @param apex Start of every line.
   * @param ringCenter Center of the ring.
   * @param first First in-plane axis of the ring (unit).
   * @param second Second in-plane axis of the ring (unit).
   * @param ringRadius Ring radius.
   * @param count Number of lines.
   */
  static spokesAppend(
    points: THREE.Vector3[],
    apex: THREE.Vector3,
    ringCenter: THREE.Vector3,
    first: THREE.Vector3,
    second: THREE.Vector3,
    ringRadius: number,
    count: number,
  ): void {
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2;
      const rim = ringCenter
        .clone()
        .addScaledVector(first, Math.cos(angle) * ringRadius)
        .addScaledVector(second, Math.sin(angle) * ringRadius);
      points.push(apex.clone(), rim);
    }
  }

  /**
   * Appends the twelve edges of a box centered on the origin.
   *
   * @param points Output endpoint list.
   * @param halfExtents Half size of the box on each axis.
   */
  static boxEdgesAppend(points: THREE.Vector3[], halfExtents: THREE.Vector3): void {
    const corners = EntityVisualShapes.boxCorners(halfExtents);
    for (const [first, second] of ENTITY_VISUAL_BOX_EDGE_CORNER_PAIRS) {
      const firstCorner = corners[first];
      const secondCorner = corners[second];
      if (firstCorner && secondCorner) {
        points.push(firstCorner.clone(), secondCorner.clone());
      }
    }
  }

  /**
   * Returns the eight corners of a box centered on the origin, ordered so bit 0
   * picks +X, bit 1 +Y and bit 2 +Z.
   *
   * @param halfExtents Half size of the box on each axis.
   * @returns Corner positions.
   */
  private static boxCorners(halfExtents: THREE.Vector3): THREE.Vector3[] {
    const corners: THREE.Vector3[] = [];
    for (let index = 0; index < 8; index++) {
      corners.push(
        new THREE.Vector3(
          index & 1 ? halfExtents.x : -halfExtents.x,
          index & 2 ? halfExtents.y : -halfExtents.y,
          index & 4 ? halfExtents.z : -halfExtents.z,
        ),
      );
    }
    return corners;
  }
}
