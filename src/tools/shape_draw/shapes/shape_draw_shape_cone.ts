import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import {
  shapeDrawParameterIntegerResolve,
  type ShapeDrawCircleType,
  type ShapeDrawShapeParameter,
} from './shape_draw_shape_parameter.js';
import { ShapeDrawShapeCircle } from './shape_draw_shape_circle.js';
import {
  SHAPE_DRAW_ROUND_AXIS_PARAMETER,
  SHAPE_DRAW_ROUND_CIRCLE_TYPE_PARAMETER,
  SHAPE_DRAW_ROUND_SIDES_PARAMETER,
  shapeDrawRoundAxisResolve,
  shapeDrawRoundCircleTypeResolve,
  shapeDrawRoundFrameCreate,
  type ShapeDrawRoundFrame,
} from './shape_draw_shape_round_frame.js';

/** Extent below which the bounds count as flat along an axis. */
const SHAPE_DRAW_CONE_FLAT_EPSILON = 1e-6;

/** Cone built as one convex hull of a ring base and an apex point. */
export class ShapeDrawShapeCone extends ShapeDrawShape {
  readonly id = 'cone';
  readonly label = 'Cone';
  readonly icon: IconName = 'shape-cone';

  /**
   * Describes side count, circle alignment and run axis.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [SHAPE_DRAW_ROUND_SIDES_PARAMETER, SHAPE_DRAW_ROUND_CIRCLE_TYPE_PARAMETER, SHAPE_DRAW_ROUND_AXIS_PARAMETER];
  }

  /**
   * Builds one convex piece: the base ring at the negative axis end and the
   * apex at the positive axis end.
   *
   * @param request Bounds and parameter values.
   * @returns Corner points of the single piece, or an empty list when flat.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const axis = shapeDrawRoundAxisResolve(request.parameters['axis']);
    const frame = shapeDrawRoundFrameCreate(request.bounds, axis);
    if (this.frameIsFlat(frame)) {
      return [];
    }
    const sides = shapeDrawParameterIntegerResolve(SHAPE_DRAW_ROUND_SIDES_PARAMETER, request.parameters);
    const circleType = shapeDrawRoundCircleTypeResolve(request.parameters['circleType']);
    return [this.conePointsCreate(frame, sides, circleType)];
  }

  /**
   * Returns whether the frame has no run length or cross-section extent.
   *
   * @param frame Cross-section frame.
   * @returns True when the shape would be flat.
   */
  private frameIsFlat(frame: ShapeDrawRoundFrame): boolean {
    return (
      frame.firstRadius <= SHAPE_DRAW_CONE_FLAT_EPSILON ||
      frame.secondRadius <= SHAPE_DRAW_CONE_FLAT_EPSILON ||
      frame.far - frame.near <= SHAPE_DRAW_CONE_FLAT_EPSILON
    );
  }

  /**
   * Lists the base ring points and the apex point.
   *
   * @param frame Cross-section frame.
   * @param sides Side count.
   * @param circleType Circle alignment.
   * @returns Points of the cone.
   */
  private conePointsCreate(
    frame: ShapeDrawRoundFrame,
    sides: number,
    circleType: ShapeDrawCircleType,
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (const angle of ShapeDrawShapeCircle.anglesCreate(sides, circleType)) {
      const point = ShapeDrawShapeCircle.pointCreate(
        frame.center,
        frame.firstAxis,
        frame.firstRadius,
        frame.secondAxis,
        frame.secondRadius,
        angle,
      );
      point[frame.axis] = frame.near;
      points.push(point);
    }
    points.push(this.apexPointCreate(frame));
    return points;
  }

  /**
   * Places the apex at the bounds center of the positive axis end.
   *
   * @param frame Cross-section frame.
   * @returns Apex point.
   */
  private apexPointCreate(frame: ShapeDrawRoundFrame): THREE.Vector3 {
    const apex = frame.center.clone();
    apex[frame.axis] = frame.far;
    return apex;
  }
}
