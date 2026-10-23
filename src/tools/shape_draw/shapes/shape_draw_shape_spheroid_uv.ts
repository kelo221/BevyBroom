import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import { shapeDrawAxesOtherThan, type ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import {
  shapeDrawParameterIntegerResolve,
  type ShapeDrawNumberParameter,
  type ShapeDrawShapeParameter,
} from './shape_draw_shape_parameter.js';
import { ShapeDrawShapeCircle } from './shape_draw_shape_circle.js';

/** Extent below which the bounds count as flat along an axis. */
const SHAPE_DRAW_SPHEROID_FLAT_EPSILON = 1e-6;

/** Latitude ring count parameter descriptor. */
const SHAPE_DRAW_SPHEROID_UV_RINGS_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'rings',
  label: 'Rings',
  defaultValue: 8,
  minimum: 2,
  step: 1,
};

/** Longitude side count parameter descriptor. */
const SHAPE_DRAW_SPHEROID_UV_SIDES_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'sides',
  label: 'Sides',
  defaultValue: 8,
  minimum: 3,
  step: 1,
};

/** Spheroid built as one convex hull of a latitude/longitude point grid. */
export class ShapeDrawShapeSpheroidUv extends ShapeDrawShape {
  readonly id = 'spheroid_uv';
  readonly label = 'Spheroid (UV)';
  readonly icon: IconName = 'sphere';

  /**
   * Describes the latitude ring count and longitude side count.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [SHAPE_DRAW_SPHEROID_UV_RINGS_PARAMETER, SHAPE_DRAW_SPHEROID_UV_SIDES_PARAMETER];
  }

  /**
   * Builds one convex piece from both poles and every interior latitude ring.
   *
   * @param request Bounds and parameter values.
   * @returns Points of the single piece, or an empty list when flat.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const frame = this.frameResolve(request);
    if (!frame) {
      return [];
    }
    const rings = shapeDrawParameterIntegerResolve(SHAPE_DRAW_SPHEROID_UV_RINGS_PARAMETER, request.parameters);
    const sides = shapeDrawParameterIntegerResolve(SHAPE_DRAW_SPHEROID_UV_SIDES_PARAMETER, request.parameters);
    return [this.gridPointsCreate(frame, rings, sides)];
  }

  /**
   * Fits the ellipsoid radii into the bounds around the polar axis.
   *
   * @param request Bounds and the up axis.
   * @returns Spheroid frame, or null when the bounds are flat.
   */
  private frameResolve(request: ShapeDrawShapeRequest): ShapeDrawSpheroidFrame | null {
    const [firstAxis, secondAxis] = shapeDrawAxesOtherThan(request.upAxis);
    const firstRadius = (request.bounds.max[firstAxis] - request.bounds.min[firstAxis]) * 0.5;
    const secondRadius = (request.bounds.max[secondAxis] - request.bounds.min[secondAxis]) * 0.5;
    if (firstRadius <= SHAPE_DRAW_SPHEROID_FLAT_EPSILON || secondRadius <= SHAPE_DRAW_SPHEROID_FLAT_EPSILON) {
      return null;
    }
    return {
      firstAxis,
      secondAxis,
      upAxis: request.upAxis,
      center: request.bounds.getCenter(new THREE.Vector3()),
      firstRadius,
      secondRadius,
      top: request.bounds.max[request.upAxis],
      bottom: request.bounds.min[request.upAxis],
    };
  }

  /**
   * Lists the pole points and every interior ring of the spheroid grid.
   *
   * @param frame Spheroid frame.
   * @param rings Latitude ring count.
   * @param sides Longitude side count.
   * @returns Grid points.
   */
  private gridPointsCreate(frame: ShapeDrawSpheroidFrame, rings: number, sides: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [this.polePointCreate(frame, frame.top)];
    for (let ring = 1; ring < rings; ring += 1) {
      this.ringPointsAppend(points, frame, -Math.PI * 0.5 + (Math.PI * ring) / rings, sides);
    }
    points.push(this.polePointCreate(frame, frame.bottom));
    return points;
  }

  /**
   * Appends the points of one interior latitude ring.
   *
   * @param points Accumulated grid points.
   * @param frame Spheroid frame.
   * @param latitude Latitude angle in radians.
   * @param sides Longitude side count.
   */
  private ringPointsAppend(
    points: THREE.Vector3[],
    frame: ShapeDrawSpheroidFrame,
    latitude: number,
    sides: number,
  ): void {
    const levelScale = Math.cos(latitude);
    const polarRadius = (frame.top - frame.bottom) * 0.5;
    for (const angle of ShapeDrawShapeCircle.anglesCreate(sides, 'edge')) {
      const point = ShapeDrawShapeCircle.pointCreate(
        frame.center,
        frame.firstAxis,
        frame.firstRadius * levelScale,
        frame.secondAxis,
        frame.secondRadius * levelScale,
        angle,
      );
      point[frame.upAxis] += Math.sin(latitude) * polarRadius;
      points.push(point);
    }
  }

  /**
   * Places one pole at a height on the polar axis.
   *
   * @param frame Spheroid frame.
   * @param height Coordinate along the polar axis.
   * @returns Pole point.
   */
  private polePointCreate(frame: ShapeDrawSpheroidFrame, height: number): THREE.Vector3 {
    const pole = frame.center.clone();
    pole[frame.upAxis] = height;
    return pole;
  }
}

/** Axes, center and extents a spheroid grid is built from. */
interface ShapeDrawSpheroidFrame {
  /** First equator axis. */
  firstAxis: ShapeDrawAxis;
  /** Second equator axis. */
  secondAxis: ShapeDrawAxis;
  /** Polar axis. */
  upAxis: ShapeDrawAxis;
  /** Bounds center. */
  center: THREE.Vector3;
  /** Equator radius along the first axis. */
  firstRadius: number;
  /** Equator radius along the second axis. */
  secondRadius: number;
  /** Coordinate of the top pole along the polar axis. */
  top: number;
  /** Coordinate of the bottom pole along the polar axis. */
  bottom: number;
}
