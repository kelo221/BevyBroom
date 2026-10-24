import * as THREE from 'three';
import type { ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import type { ShapeDrawCircleType } from './shape_draw_shape_parameter.js';

/** Shared circle and ellipse point generation for round shapes. */
export class ShapeDrawShapeCircle {
  /**
   * Lists the polar angles of a circle's side vertices.
   *
   * @param sides Side count (clamped to at least three).
   * @param circleType Edge alignment puts a flat side start at angle zero;
   *   vertex alignment puts the first vertex at angle zero.
   * @returns Angles in radians, one per side, counterclockwise.
   */
  static anglesCreate(sides: number, circleType: ShapeDrawCircleType): number[] {
    const safeSides = Math.max(3, Math.round(sides));
    const step = (Math.PI * 2) / safeSides;
    const offset = circleType === 'edge' ? step * 0.5 : 0;
    const angles: number[] = [];
    for (let index = 0; index < safeSides; index += 1) {
      angles.push(offset + index * step);
    }
    return angles;
  }

  /**
   * Places a point on an ellipse cross-section through a center.
   *
   * @param center Center of the cross-section (its coordinate on the third axis
   *   is kept).
   * @param firstAxis First cross-section axis.
   * @param firstRadius Ellipse radius along the first axis.
   * @param secondAxis Second cross-section axis.
   * @param secondRadius Ellipse radius along the second axis.
   * @param angle Polar angle in radians.
   * @returns New point on the ellipse.
   */
  static pointCreate(
    center: THREE.Vector3,
    firstAxis: ShapeDrawAxis,
    firstRadius: number,
    secondAxis: ShapeDrawAxis,
    secondRadius: number,
    angle: number,
  ): THREE.Vector3 {
    const point = center.clone();
    point[firstAxis] += Math.cos(angle) * firstRadius;
    point[secondAxis] += Math.sin(angle) * secondRadius;
    return point;
  }

  /**
   * Clamps a wall thickness so an inner ellipse keeps a positive radius on both
   * axes.
   *
   * @param firstRadius Outer radius along the first axis.
   * @param secondRadius Outer radius along the second axis.
   * @param wallThickness Requested wall thickness.
   * @returns Thickness that leaves both inner radii above zero.
   */
  static wallThicknessClamp(firstRadius: number, secondRadius: number, wallThickness: number): number {
    const smallestRadius = Math.min(firstRadius, secondRadius);
    return Math.min(Math.max(0, wallThickness), smallestRadius * 0.9);
  }

  /**
   * Builds one convex extruded annular wedge between two arc angles.
   *
   * @param request Wedge placement, radii and extrude depths.
   * @returns Corner points of the closed wedge.
   */
  static wedgePointsCreate(request: ShapeDrawCircleWedgeRequest): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (const depth of [request.depthNear, request.depthFar]) {
      points.push(...this.wedgeSectionCreate(request, depth));
    }
    return points;
  }

  /**
   * Builds the four corner points of one wedge cross-section at a depth.
   *
   * @param request Wedge placement and radii.
   * @param depth Coordinate along the depth axis.
   * @returns Corner points of the cross-section in wedge order.
   */
  private static wedgeSectionCreate(request: ShapeDrawCircleWedgeRequest, depth: number): THREE.Vector3[] {
    return [
      ...this.wedgeSectionArcCreate(request, depth, request.outerFirstRadius, request.outerSecondRadius, [
        request.angleStart,
        request.angleEnd,
      ]),
      ...this.wedgeSectionArcCreate(request, depth, request.innerFirstRadius, request.innerSecondRadius, [
        request.angleEnd,
        request.angleStart,
      ]),
    ];
  }

  /**
   * Builds the corner points of one wedge arc at a depth, in the given angle
   * order.
   *
   * @param request Wedge placement and radii.
   * @param depth Coordinate along the depth axis.
   * @param firstRadius Ellipse radius along the first axis.
   * @param secondRadius Ellipse radius along the second axis.
   * @param angles Arc angles of the corners in output order.
   * @returns Corner points of the arc.
   */
  private static wedgeSectionArcCreate(
    request: ShapeDrawCircleWedgeRequest,
    depth: number,
    firstRadius: number,
    secondRadius: number,
    angles: [number, number],
  ): THREE.Vector3[] {
    return angles.map((angle) => this.wedgeCornerPointCreate(request, angle, firstRadius, secondRadius, depth));
  }

  /**
   * Places one wedge corner point on an arc radius at an extrude depth.
   *
   * @param request Wedge placement and radii.
   * @param angle Arc angle of the corner.
   * @param firstRadius Ellipse radius along the first axis.
   * @param secondRadius Ellipse radius along the second axis.
   * @param depth Coordinate along the depth axis.
   * @returns Corner point.
   */
  private static wedgeCornerPointCreate(
    request: ShapeDrawCircleWedgeRequest,
    angle: number,
    firstRadius: number,
    secondRadius: number,
    depth: number,
  ): THREE.Vector3 {
    const point = this.pointCreate(
      request.center,
      request.firstAxis,
      firstRadius,
      request.secondAxis,
      secondRadius,
      angle,
    );
    point[request.depthAxis] = depth;
    return point;
  }
}

/** Placement of one extruded annular wedge. */
export interface ShapeDrawCircleWedgeRequest {
  /** Center of the arc cross-section. */
  center: THREE.Vector3;
  /** First cross-section axis. */
  firstAxis: ShapeDrawAxis;
  /** Second cross-section axis. */
  secondAxis: ShapeDrawAxis;
  /** Axis the wedge extrudes along. */
  depthAxis: ShapeDrawAxis;
  /** Wedge start angle in radians. */
  angleStart: number;
  /** Wedge end angle in radians. */
  angleEnd: number;
  /** Outer ellipse radius along the first axis. */
  outerFirstRadius: number;
  /** Outer ellipse radius along the second axis. */
  outerSecondRadius: number;
  /** Inner ellipse radius along the first axis. */
  innerFirstRadius: number;
  /** Inner ellipse radius along the second axis. */
  innerSecondRadius: number;
  /** Near coordinate along the depth axis. */
  depthNear: number;
  /** Far coordinate along the depth axis. */
  depthFar: number;
}
