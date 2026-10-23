import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import { shapeDrawAxesOtherThan, type ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import type { ShapeDrawShapeParameter } from './shape_draw_shape_parameter.js';
import { ShapeDrawIcospherePoints } from './shape_draw_shape_icosphere.js';

/** Subdivision level parameter descriptor. */
const SHAPE_DRAW_SPHEROID_ICO_SUBDIVISION_PARAMETER: ShapeDrawShapeParameter = {
  kind: 'number',
  id: 'subdivision',
  label: 'Subdivision',
  defaultValue: 1,
  minimum: 1,
  step: 1,
};

/** Highest subdivision level accepted (keeps point counts sane). */
const SHAPE_DRAW_SPHEROID_ICO_MAXIMUM_SUBDIVISION = 4;

/** Spheroid built as one convex hull of a subdivided icosahedron. */
export class ShapeDrawShapeSpheroidIcosahedron extends ShapeDrawShape {
  readonly id = 'spheroid_ico';
  readonly label = 'Spheroid (Icosahedron)';
  readonly icon: IconName = 'shape-polyhedron';

  /**
   * Describes the icosahedron subdivision level.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [SHAPE_DRAW_SPHEROID_ICO_SUBDIVISION_PARAMETER];
  }

  /**
   * Builds one convex piece from every icosphere vertex scaled into the bounds.
   *
   * @param request Bounds and parameter values.
   * @returns Points of the single piece.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const frame = this.frameResolve(request);
    const subdivision = this.subdivisionResolve(request.parameters['subdivision']);
    const points = ShapeDrawIcospherePoints.create(subdivision).map((unit) => this.ellipsoidPointCreate(unit, frame));
    return [points];
  }

  /**
   * Fits the ellipsoid radii into the bounds around the polar axis.
   *
   * @param request Bounds and the up axis.
   * @returns Spheroid frame.
   */
  private frameResolve(request: ShapeDrawShapeRequest): ShapeDrawSpheroidIcoFrame {
    const [firstAxis, secondAxis] = shapeDrawAxesOtherThan(request.upAxis);
    return {
      firstAxis,
      secondAxis,
      upAxis: request.upAxis,
      center: request.bounds.getCenter(new THREE.Vector3()),
      firstRadius: (request.bounds.max[firstAxis] - request.bounds.min[firstAxis]) * 0.5,
      secondRadius: (request.bounds.max[secondAxis] - request.bounds.min[secondAxis]) * 0.5,
      polarRadius: (request.bounds.max[request.upAxis] - request.bounds.min[request.upAxis]) * 0.5,
    };
  }

  /**
   * Returns the subdivision level clamped to the accepted range.
   *
   * @param value Stored parameter value.
   * @returns Subdivision level from one to the maximum.
   */
  private subdivisionResolve(value: unknown): number {
    const resolved = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(resolved)) {
      return 1;
    }
    return Math.min(SHAPE_DRAW_SPHEROID_ICO_MAXIMUM_SUBDIVISION, Math.max(1, Math.round(resolved)));
  }

  /**
   * Scales one unit sphere point onto the ellipsoid of a frame.
   *
   * @param unit Point on the unit sphere.
   * @param frame Spheroid frame.
   * @returns Point on the ellipsoid.
   */
  private ellipsoidPointCreate(unit: THREE.Vector3, frame: ShapeDrawSpheroidIcoFrame): THREE.Vector3 {
    const point = frame.center.clone();
    point[frame.firstAxis] += unit.x * frame.firstRadius;
    point[frame.secondAxis] += unit.z * frame.secondRadius;
    point[frame.upAxis] += unit.y * frame.polarRadius;
    return point;
  }
}

/** Axes, center and radii the icosphere is scaled into. */
interface ShapeDrawSpheroidIcoFrame {
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
  /** Polar radius along the polar axis. */
  polarRadius: number;
}
