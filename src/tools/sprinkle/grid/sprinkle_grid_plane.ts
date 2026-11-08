import * as THREE from 'three';

/** World axis name. */
export type SprinkleGridAxis = 'x' | 'y' | 'z';

/**
 * World-aligned plane a Sprinkle grid lies in: the axis plane most facing a
 * surface normal. The plane's U and V axes follow one fixed convention so
 * repeated strokes hit the same cells:
 *
 * - Normal axis Y (floors and ceilings): U = X, V = Z.
 * - Normal axis X (walls facing X): U = Z, V = Y.
 * - Normal axis Z (walls facing Z): U = X, V = Y.
 */
export class SprinkleGridPlane {
  /** World axis the plane is perpendicular to. */
  readonly normalAxis: SprinkleGridAxis;
  /** World axis of the first in-plane coordinate. */
  readonly uAxis: SprinkleGridAxis;
  /** World axis of the second in-plane coordinate. */
  readonly vAxis: SprinkleGridAxis;

  /**
   * Creates the plane perpendicular to a world axis.
   *
   * @param normalAxis World axis the plane is perpendicular to.
   */
  constructor(normalAxis: SprinkleGridAxis) {
    this.normalAxis = normalAxis;
    this.uAxis = normalAxis === 'x' ? 'z' : 'x';
    this.vAxis = normalAxis === 'y' ? 'z' : 'y';
  }

  /**
   * Returns the plane most facing a normal; ties prefer Y, then X.
   *
   * @param normal Surface normal in world space.
   * @returns Plane perpendicular to the normal's dominant axis.
   */
  static fromNormal(normal: THREE.Vector3): SprinkleGridPlane {
    const absoluteX = Math.abs(normal.x);
    const absoluteY = Math.abs(normal.y);
    const absoluteZ = Math.abs(normal.z);
    if (absoluteY >= absoluteX && absoluteY >= absoluteZ) {
      return new SprinkleGridPlane('y');
    }
    return new SprinkleGridPlane(absoluteX >= absoluteZ ? 'x' : 'z');
  }

  /**
   * Returns a point's coordinate along the plane's U axis.
   *
   * @param point World point.
   * @returns U coordinate.
   */
  uRead(point: THREE.Vector3): number {
    return point[this.uAxis];
  }

  /**
   * Returns a point's coordinate along the plane's V axis.
   *
   * @param point World point.
   * @returns V coordinate.
   */
  vRead(point: THREE.Vector3): number {
    return point[this.vAxis];
  }

  /**
   * Returns a point's coordinate along the plane's normal axis.
   *
   * @param point World point.
   * @returns Normal-axis coordinate.
   */
  heightRead(point: THREE.Vector3): number {
    return point[this.normalAxis];
  }

  /**
   * Builds the world point with given plane coordinates.
   *
   * @param u U coordinate.
   * @param v V coordinate.
   * @param height Normal-axis coordinate.
   * @returns New world point.
   */
  pointCompose(u: number, v: number, height: number): THREE.Vector3 {
    const point = new THREE.Vector3();
    point[this.uAxis] = u;
    point[this.vAxis] = v;
    point[this.normalAxis] = height;
    return point;
  }

  /**
   * Returns the unit world vector along the normal axis, pointing to the side a
   * surface normal faces.
   *
   * @param surfaceNormal Surface normal choosing the side.
   * @returns Unit axis vector on the normal's side of the plane.
   */
  normalAxisToward(surfaceNormal: THREE.Vector3): THREE.Vector3 {
    const direction = new THREE.Vector3();
    direction[this.normalAxis] = surfaceNormal[this.normalAxis] < 0 ? -1 : 1;
    return direction;
  }
}
