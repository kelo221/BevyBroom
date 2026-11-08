import * as THREE from 'three';
import type { SprinkleSurfaceHit } from '@/tools/sprinkle/sprinkle_types.js';
import { SprinkleGridPlane } from '@/tools/sprinkle/grid/sprinkle_grid_plane.js';
import type { SprinkleGridCell } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import type { SprinkleGridCircle } from '@/tools/sprinkle/grid/sprinkle_grid_cell_enumerator.js';

/** World-space ray that projects one grid cell onto the surface. */
export interface SprinkleCellRay {
  /** Ray starting above the cell center and pointing toward the surface. */
  readonly ray: THREE.Ray;
  /** Farthest hit distance along the ray. */
  readonly maxDistance: number;
}

/**
 * Space one Sprinkle dab works in: a cylinder around the brush center whose
 * axis is the grid plane's normal axis. Its in-plane radius is the brush radius
 * and it reaches the brush radius above and below the center.
 */
export class SprinkleBrushVolume {
  /** Grid plane most facing the surface under the brush. */
  readonly plane: SprinkleGridPlane;
  /** World brush center on the surface. */
  readonly center: THREE.Vector3;
  /** Brush radius in meters. */
  readonly radius: number;
  private readonly towardSurfaceSide: THREE.Vector3;

  /**
   * Creates the volume of a dab.
   *
   * @param centerHit Surface hit under the brush center.
   * @param radius Brush radius in meters.
   */
  constructor(centerHit: SprinkleSurfaceHit, radius: number) {
    this.plane = SprinkleGridPlane.fromNormal(centerHit.normal);
    this.center = centerHit.point.clone();
    this.radius = radius;
    this.towardSurfaceSide = this.plane.normalAxisToward(centerHit.normal);
  }

  /**
   * Returns the circle the volume covers in its grid plane.
   *
   * @returns Plane circle.
   */
  circleRead(): SprinkleGridCircle {
    return { centerU: this.plane.uRead(this.center), centerV: this.plane.vRead(this.center), radius: this.radius };
  }

  /**
   * Returns the in-plane distance from the brush center to a point.
   *
   * @param point World point.
   * @returns Distance in the grid plane, ignoring the normal axis.
   */
  planeDistanceTo(point: THREE.Vector3): number {
    const deltaU = this.plane.uRead(point) - this.plane.uRead(this.center);
    const deltaV = this.plane.vRead(point) - this.plane.vRead(this.center);
    return Math.hypot(deltaU, deltaV);
  }

  /**
   * Returns whether a point lies inside the volume, widened in the plane.
   *
   * @param point World point.
   * @param planeMargin Extra in-plane distance accepted beyond the radius.
   * @returns True inside the cylinder.
   */
  contains(point: THREE.Vector3, planeMargin: number = 0): boolean {
    const heightDelta = Math.abs(this.plane.heightRead(point) - this.plane.heightRead(this.center));
    return heightDelta <= this.radius && this.planeDistanceTo(point) <= this.radius + planeMargin;
  }

  /**
   * Builds the ray that projects a cell onto the surface: it starts at the cell
   * center one radius above the brush center on the side the surface faces and
   * runs down the normal axis through the whole volume height.
   *
   * @param cell Grid cell.
   * @returns Projection ray and its length.
   */
  cellRayBuild(cell: SprinkleGridCell): SprinkleCellRay {
    const aboveHeight =
      this.plane.heightRead(this.center) + this.radius * this.plane.heightRead(this.towardSurfaceSide);
    const origin = this.plane.pointCompose(cell.centerU, cell.centerV, aboveHeight);
    const direction = this.towardSurfaceSide.clone().negate();
    return { ray: new THREE.Ray(origin, direction), maxDistance: this.radius * 2 };
  }
}
