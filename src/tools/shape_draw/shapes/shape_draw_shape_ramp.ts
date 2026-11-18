import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import type { ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import {
  shapeDrawParameterNumberResolve,
  type ShapeDrawNumberParameter,
  type ShapeDrawShapeParameter,
} from './shape_draw_shape_parameter.js';
import {
  SHAPE_DRAW_DIRECTION_PARAMETER,
  shapeDrawDirectionAscending,
  shapeDrawDirectionLateralAxisResolve,
  shapeDrawDirectionResolve,
  shapeDrawDirectionTravelAxisResolve,
} from './shape_draw_shape_direction.js';

/** Extent below which the bounds count as flat along an axis. */
const SHAPE_DRAW_RAMP_FLAT_EPSILON = 1e-6;

/** Height of the low end parameter descriptor; zero makes a plain wedge. */
const SHAPE_DRAW_RAMP_LOW_HEIGHT_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'lowHeight',
  label: 'Low End Height',
  defaultValue: 0,
  minimum: 0,
  step: 0.25,
};

/** Axes and end coordinates one ramp is built from. */
interface ShapeDrawRampFrame {
  /** Flat axis the slope climbs along. */
  travelAxis: ShapeDrawAxis;
  /** Flat axis across the slope. */
  lateralAxis: ShapeDrawAxis;
  /** Axis the slope rises along. */
  upAxis: ShapeDrawAxis;
  /** Travel coordinate of the low end. */
  lowEnd: number;
  /** Travel coordinate of the high end. */
  highEnd: number;
  /** Up coordinate of the floor. */
  floor: number;
  /** Up coordinate of the top of the low end. */
  lowTop: number;
  /** Up coordinate of the top of the high end. */
  highTop: number;
}

/**
 * A single convex slope brush: a wedge rising from one end of the bounds to the
 * other.
 */
export class ShapeDrawShapeRamp extends ShapeDrawShape {
  readonly id = 'ramp';
  readonly label = 'Ramp';
  readonly icon: IconName = 'shape-ramp';

  /**
   * Describes the climbing direction and the height of the low end.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [SHAPE_DRAW_DIRECTION_PARAMETER, SHAPE_DRAW_RAMP_LOW_HEIGHT_PARAMETER];
  }

  /**
   * Builds one wedge piece whose slope climbs from the low end to the full
   * bounds height at the high end.
   *
   * @param request Bounds, parameter values and the up axis.
   * @returns Corner points of the wedge, or an empty list when flat.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const height = request.bounds.max[request.upAxis] - request.bounds.min[request.upAxis];
    if (height <= SHAPE_DRAW_RAMP_FLAT_EPSILON) {
      return [];
    }
    return [this.rampPointsCreate(this.rampFrameCreate(request), request.bounds)];
  }

  /**
   * Resolves the axes and end coordinates of the ramp.
   *
   * @param request Bounds, parameter values and the up axis.
   * @returns Ramp frame.
   */
  private rampFrameCreate(request: ShapeDrawShapeRequest): ShapeDrawRampFrame {
    const direction = shapeDrawDirectionResolve(request.parameters['direction']);
    const travelAxis = shapeDrawDirectionTravelAxisResolve(request.upAxis, direction);
    const minimum = request.bounds.min[travelAxis];
    const maximum = request.bounds.max[travelAxis];
    const ascending = shapeDrawDirectionAscending(direction);
    const floor = request.bounds.min[request.upAxis];
    const highTop = request.bounds.max[request.upAxis];
    const lowHeight = shapeDrawParameterNumberResolve(SHAPE_DRAW_RAMP_LOW_HEIGHT_PARAMETER, request.parameters);
    return {
      travelAxis,
      lateralAxis: shapeDrawDirectionLateralAxisResolve(request.upAxis, travelAxis),
      upAxis: request.upAxis,
      lowEnd: ascending ? minimum : maximum,
      highEnd: ascending ? maximum : minimum,
      floor,
      lowTop: Math.min(floor + lowHeight, highTop),
      highTop,
    };
  }

  /**
   * Lists the corner points of the ramp: the full floor rectangle, the top of
   * the high end and, when the low end has height, the top of the low end.
   *
   * @param frame Ramp frame.
   * @param bounds Bounds the ramp fits into.
   * @returns Corner points of the convex wedge.
   */
  private rampPointsCreate(frame: ShapeDrawRampFrame, bounds: THREE.Box3): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const lowEndRaised = frame.lowTop - frame.floor > SHAPE_DRAW_RAMP_FLAT_EPSILON;
    for (const lateral of [bounds.min[frame.lateralAxis], bounds.max[frame.lateralAxis]]) {
      points.push(this.rampPointCreate(frame, frame.lowEnd, lateral, frame.floor));
      points.push(this.rampPointCreate(frame, frame.highEnd, lateral, frame.floor));
      points.push(this.rampPointCreate(frame, frame.highEnd, lateral, frame.highTop));
      if (lowEndRaised) {
        points.push(this.rampPointCreate(frame, frame.lowEnd, lateral, frame.lowTop));
      }
    }
    return points;
  }

  /**
   * Builds one point from travel, lateral and up coordinates.
   *
   * @param frame Ramp frame naming the axes.
   * @param travel Coordinate along the travel axis.
   * @param lateral Coordinate along the lateral axis.
   * @param up Coordinate along the up axis.
   * @returns The point.
   */
  private rampPointCreate(frame: ShapeDrawRampFrame, travel: number, lateral: number, up: number): THREE.Vector3 {
    const point = new THREE.Vector3();
    point[frame.travelAxis] = travel;
    point[frame.lateralAxis] = lateral;
    point[frame.upAxis] = up;
    return point;
  }
}
