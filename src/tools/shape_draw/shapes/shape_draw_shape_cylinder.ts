import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import {
  shapeDrawParameterIntegerResolve,
  shapeDrawParameterNumberResolve,
  type ShapeDrawChoiceParameter,
  type ShapeDrawCircleType,
  type ShapeDrawNumberParameter,
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

/** Default hollow wall thickness in world units (two default grid steps). */
export const SHAPE_DRAW_CYLINDER_DEFAULT_WALL_THICKNESS = 0.5;

/** Extent below which the bounds count as flat along an axis. */
const SHAPE_DRAW_CYLINDER_FLAT_EPSILON = 1e-6;

/** Hollow toggle parameter descriptor. */
const SHAPE_DRAW_CYLINDER_HOLLOW_PARAMETER: ShapeDrawChoiceParameter = {
  kind: 'choice',
  id: 'hollow',
  label: 'Hollow',
  defaultValue: 'off',
  choices: [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ],
};

/** Wall thickness parameter descriptor. */
const SHAPE_DRAW_CYLINDER_WALL_THICKNESS_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'wallThickness',
  label: 'Wall Thickness',
  defaultValue: SHAPE_DRAW_CYLINDER_DEFAULT_WALL_THICKNESS,
  minimum: 0.01,
  step: 0.25,
};

/** Cylinder built as one convex prism, or one wedge per side when hollow. */
export class ShapeDrawShapeCylinder extends ShapeDrawShape {
  readonly id = 'cylinder';
  readonly label = 'Cylinder';
  readonly icon: IconName = 'cylinder';

  /**
   * Describes side count, circle alignment, run axis and the hollow wall.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [
      SHAPE_DRAW_ROUND_SIDES_PARAMETER,
      SHAPE_DRAW_ROUND_CIRCLE_TYPE_PARAMETER,
      SHAPE_DRAW_ROUND_AXIS_PARAMETER,
      SHAPE_DRAW_CYLINDER_HOLLOW_PARAMETER,
      SHAPE_DRAW_CYLINDER_WALL_THICKNESS_PARAMETER,
    ];
  }

  /**
   * Builds a single convex prism piece when solid, or one convex wedge piece
   * per side when hollow.
   *
   * @param request Bounds and parameter values.
   * @returns Corner points of every piece, or an empty list when flat.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const axis = shapeDrawRoundAxisResolve(request.parameters['axis']);
    const frame = shapeDrawRoundFrameCreate(request.bounds, axis);
    if (this.frameIsFlat(frame)) {
      return [];
    }
    const sides = shapeDrawParameterIntegerResolve(SHAPE_DRAW_ROUND_SIDES_PARAMETER, request.parameters);
    const circleType = shapeDrawRoundCircleTypeResolve(request.parameters['circleType']);
    if (request.parameters['hollow'] === 'on') {
      return this.hollowWedgePiecesCreate(frame, request, sides, circleType);
    }
    return [this.prismPointsCreate(frame, sides, circleType)];
  }

  /**
   * Returns whether the frame has no run length or cross-section extent.
   *
   * @param frame Cross-section frame.
   * @returns True when the shape would be flat.
   */
  private frameIsFlat(frame: ShapeDrawRoundFrame): boolean {
    return (
      frame.firstRadius <= SHAPE_DRAW_CYLINDER_FLAT_EPSILON ||
      frame.secondRadius <= SHAPE_DRAW_CYLINDER_FLAT_EPSILON ||
      frame.far - frame.near <= SHAPE_DRAW_CYLINDER_FLAT_EPSILON
    );
  }

  /**
   * Builds the corner points of the solid prism: both end rings.
   *
   * @param frame Cross-section frame.
   * @param sides Side count.
   * @param circleType Circle alignment.
   * @returns Corner points of the prism.
   */
  private prismPointsCreate(
    frame: ShapeDrawRoundFrame,
    sides: number,
    circleType: ShapeDrawCircleType,
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (const depth of [frame.near, frame.far]) {
      for (const angle of ShapeDrawShapeCircle.anglesCreate(sides, circleType)) {
        points.push(this.ringPointCreate(frame, angle, frame.firstRadius, frame.secondRadius, depth));
      }
    }
    return points;
  }

  /**
   * Builds one convex wall wedge per side of the hollow ring.
   *
   * @param frame Cross-section frame.
   * @param request Bounds and parameter values.
   * @param sides Side count.
   * @param circleType Circle alignment.
   * @returns Corner points of every wedge.
   */
  private hollowWedgePiecesCreate(
    frame: ShapeDrawRoundFrame,
    request: ShapeDrawShapeRequest,
    sides: number,
    circleType: ShapeDrawCircleType,
  ): THREE.Vector3[][] {
    const wall = shapeDrawParameterNumberResolve(SHAPE_DRAW_CYLINDER_WALL_THICKNESS_PARAMETER, request.parameters);
    const thickness = ShapeDrawShapeCircle.wallThicknessClamp(frame.firstRadius, frame.secondRadius, wall);
    const angles = ShapeDrawShapeCircle.anglesCreate(sides, circleType);
    const pieces: THREE.Vector3[][] = [];
    for (let index = 0; index < angles.length; index += 1) {
      const start = angles[index];
      const end = angles[(index + 1) % angles.length];
      if (start === undefined || end === undefined) {
        continue;
      }
      pieces.push(this.wedgePointsCreate(frame, start, end, thickness));
    }
    return pieces;
  }

  /**
   * Builds one wall wedge between two ring angles.
   *
   * @param frame Cross-section frame.
   * @param start Wedge start angle.
   * @param end Wedge end angle.
   * @param thickness Wall thickness.
   * @returns Corner points of the wedge.
   */
  private wedgePointsCreate(
    frame: ShapeDrawRoundFrame,
    start: number,
    end: number,
    thickness: number,
  ): THREE.Vector3[] {
    return ShapeDrawShapeCircle.wedgePointsCreate({
      center: frame.center,
      firstAxis: frame.firstAxis,
      secondAxis: frame.secondAxis,
      depthAxis: frame.axis,
      angleStart: start,
      angleEnd: end,
      outerFirstRadius: frame.firstRadius,
      outerSecondRadius: frame.secondRadius,
      innerFirstRadius: frame.firstRadius - thickness,
      innerSecondRadius: frame.secondRadius - thickness,
      depthNear: frame.near,
      depthFar: frame.far,
    });
  }

  /**
   * Places one point on a ring at an extrude depth.
   *
   * @param frame Cross-section frame.
   * @param angle Ring angle.
   * @param firstRadius Ellipse radius along the first axis.
   * @param secondRadius Ellipse radius along the second axis.
   * @param depth Coordinate along the run axis.
   * @returns Ring point.
   */
  private ringPointCreate(
    frame: ShapeDrawRoundFrame,
    angle: number,
    firstRadius: number,
    secondRadius: number,
    depth: number,
  ): THREE.Vector3 {
    const point = ShapeDrawShapeCircle.pointCreate(
      frame.center,
      frame.firstAxis,
      firstRadius,
      frame.secondAxis,
      secondRadius,
      angle,
    );
    point[frame.axis] = depth;
    return point;
  }
}
