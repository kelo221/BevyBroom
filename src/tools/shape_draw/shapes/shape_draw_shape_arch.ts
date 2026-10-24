import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import { shapeDrawAxesOtherThan, type ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import {
  shapeDrawParameterIntegerResolve,
  shapeDrawParameterNumberResolve,
  type ShapeDrawChoiceParameter,
  type ShapeDrawNumberParameter,
  type ShapeDrawShapeParameter,
} from './shape_draw_shape_parameter.js';
import { ShapeDrawShapeCircle } from './shape_draw_shape_circle.js';

/** Default arch wall thickness in world units (two default grid steps). */
export const SHAPE_DRAW_ARCH_DEFAULT_THICKNESS = 0.5;

/** Extent below which the bounds count as flat along an axis. */
const SHAPE_DRAW_ARCH_FLAT_EPSILON = 1e-6;

/** Angle where the arch apex sits, in radians. */
const SHAPE_DRAW_ARCH_APEX_ANGLE = Math.PI * 0.5;

/** Side count parameter descriptor. */
const SHAPE_DRAW_ARCH_SIDES_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'sides',
  label: 'Sides',
  defaultValue: 8,
  minimum: 3,
  step: 1,
};

/** Wall thickness parameter descriptor. */
const SHAPE_DRAW_ARCH_THICKNESS_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'thickness',
  label: 'Thickness',
  defaultValue: SHAPE_DRAW_ARCH_DEFAULT_THICKNESS,
  minimum: 0.01,
  step: 0.25,
};

/** Spandrel fill parameter descriptor. */
const SHAPE_DRAW_ARCH_SPANDREL_PARAMETER: ShapeDrawChoiceParameter = {
  kind: 'choice',
  id: 'spandrelFill',
  label: 'Spandrel Fill',
  defaultValue: 'off',
  choices: [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ],
};

/** Arch built from one convex wedge per side plus optional corner fill. */
export class ShapeDrawShapeArch extends ShapeDrawShape {
  readonly id = 'arch';
  readonly label = 'Arch';
  readonly icon: IconName = 'shape-arch';

  /**
   * Describes side count, wall thickness and the spandrel fill toggle.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [SHAPE_DRAW_ARCH_SIDES_PARAMETER, SHAPE_DRAW_ARCH_THICKNESS_PARAMETER, SHAPE_DRAW_ARCH_SPANDREL_PARAMETER];
  }

  /**
   * Builds the arch ring wedges spanning the bounds' longer horizontal axis,
   * and when spandrel fill is on, one convex corner piece per side segment.
   *
   * @param request Bounds, parameter values and the up axis.
   * @returns Corner points of every convex piece, or an empty list when flat.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const frame = this.frameResolve(request);
    if (!frame) {
      return [];
    }
    const sideCount = shapeDrawParameterIntegerResolve(SHAPE_DRAW_ARCH_SIDES_PARAMETER, request.parameters);
    const pieces = this.ringPiecesCreate(frame, request, sideCount);
    if (request.parameters['spandrelFill'] === 'on') {
      pieces.push(...this.spandrelPiecesCreate(frame, sideCount));
    }
    return pieces;
  }

  /**
   * Resolves the arch frame: span axis, extrude axis and the ellipse radii.
   *
   * @param request Bounds, parameter values and the up axis.
   * @returns Frame, or null when the bounds are flat.
   */
  private frameResolve(request: ShapeDrawShapeRequest): ShapeDrawArchFrame | null {
    const flatAxes = shapeDrawAxesOtherThan(request.upAxis);
    const spanAxis = this.spanAxisResolve(request, flatAxes);
    const extrudeAxis = spanAxis === flatAxes[0] ? flatAxes[1] : flatAxes[0];
    const spanExtent = request.bounds.max[spanAxis] - request.bounds.min[spanAxis];
    const riseExtent = request.bounds.max[request.upAxis] - request.bounds.min[request.upAxis];
    if (spanExtent <= SHAPE_DRAW_ARCH_FLAT_EPSILON || riseExtent <= SHAPE_DRAW_ARCH_FLAT_EPSILON) {
      return null;
    }
    return this.frameCreate(request, spanAxis, extrudeAxis, spanExtent, riseExtent);
  }

  /**
   * Returns the horizontal axis with the larger extent.
   *
   * @param request Bounds and the up axis.
   * @param flatAxes The two horizontal axes of the frame.
   * @returns Axis the arch spans.
   */
  private spanAxisResolve(
    request: ShapeDrawShapeRequest,
    flatAxes: readonly [ShapeDrawAxis, ShapeDrawAxis],
  ): ShapeDrawAxis {
    const firstExtent = request.bounds.max[flatAxes[0]] - request.bounds.min[flatAxes[0]];
    const secondExtent = request.bounds.max[flatAxes[1]] - request.bounds.min[flatAxes[1]];
    return firstExtent >= secondExtent ? flatAxes[0] : flatAxes[1];
  }

  /**
   * Builds the arch frame for resolved axes.
   *
   * @param request Bounds and the up axis.
   * @param spanAxis Axis the arch spans.
   * @param extrudeAxis Axis the arch extrudes along.
   * @param spanExtent Extent along the span axis.
   * @param riseExtent Extent along the up axis.
   * @returns Arch frame.
   */
  private frameCreate(
    request: ShapeDrawShapeRequest,
    spanAxis: ShapeDrawAxis,
    extrudeAxis: ShapeDrawAxis,
    spanExtent: number,
    riseExtent: number,
  ): ShapeDrawArchFrame {
    return {
      spanAxis,
      extrudeAxis,
      upAxis: request.upAxis,
      center: this.centerResolve(request, spanAxis, extrudeAxis),
      spanRadius: spanExtent * 0.5,
      riseRadius: riseExtent,
      extrudeNear: request.bounds.min[extrudeAxis],
      extrudeFar: request.bounds.max[extrudeAxis],
      top: request.bounds.max[request.upAxis],
    };
  }

  /**
   * Returns the arc center: mid-span, at the bounds floor, mid-extrude.
   *
   * @param request Bounds and the up axis.
   * @param spanAxis Axis the arch spans.
   * @param extrudeAxis Axis the arch extrudes along.
   * @returns Arc center point.
   */
  private centerResolve(
    request: ShapeDrawShapeRequest,
    spanAxis: ShapeDrawAxis,
    extrudeAxis: ShapeDrawAxis,
  ): THREE.Vector3 {
    const center = request.bounds.getCenter(new THREE.Vector3());
    center[spanAxis] = (request.bounds.min[spanAxis] + request.bounds.max[spanAxis]) * 0.5;
    center[extrudeAxis] = (request.bounds.min[extrudeAxis] + request.bounds.max[extrudeAxis]) * 0.5;
    center[request.upAxis] = request.bounds.min[request.upAxis];
    return center;
  }

  /**
   * Builds one convex annular wedge per arch side.
   *
   * @param frame Arch frame.
   * @param request Bounds and parameter values.
   * @param sideCount Side count of the arch.
   * @returns Corner points of every ring wedge.
   */
  private ringPiecesCreate(
    frame: ShapeDrawArchFrame,
    request: ShapeDrawShapeRequest,
    sideCount: number,
  ): THREE.Vector3[][] {
    const thickness = shapeDrawParameterNumberResolve(SHAPE_DRAW_ARCH_THICKNESS_PARAMETER, request.parameters);
    const innerSpan =
      frame.spanRadius - ShapeDrawShapeCircle.wallThicknessClamp(frame.spanRadius, frame.riseRadius, thickness);
    const innerRise =
      frame.riseRadius - ShapeDrawShapeCircle.wallThicknessClamp(frame.spanRadius, frame.riseRadius, thickness);
    const pieces: THREE.Vector3[][] = [];
    for (const [start, end] of this.segmentAngleRanges(sideCount)) {
      pieces.push(this.wedgePointsCreate(frame, start, end, innerSpan, innerRise));
    }
    return pieces;
  }

  /**
   * Builds one convex corner piece per side segment when spandrel fill is on.
   *
   * @param frame Arch frame.
   * @param sideCount Side count of the arch.
   * @returns Corner points of every spandrel piece.
   */
  private spandrelPiecesCreate(frame: ShapeDrawArchFrame, sideCount: number): THREE.Vector3[][] {
    const pieces: THREE.Vector3[][] = [];
    for (const [start, end] of this.segmentAngleRanges(sideCount)) {
      for (const [clipStart, clipEnd] of this.rangeApexSplits(start, end)) {
        const points = this.spandrelPiecePointsCreate(frame, clipStart, clipEnd);
        if (points) {
          pieces.push(points);
        }
      }
    }
    return pieces;
  }

  /**
   * Splits the half turn into equal side ranges from angle zero to pi.
   *
   * @param sideCount Side count of the arch.
   * @returns Start and end angle of every side.
   */
  private segmentAngleRanges(sideCount: number): [number, number][] {
    const ranges: [number, number][] = [];
    const step = Math.PI / sideCount;
    for (let index = 0; index < sideCount; index += 1) {
      ranges.push([index * step, (index + 1) * step]);
    }
    return ranges;
  }

  /**
   * Splits one side range at the apex angle.
   *
   * @param start Range start angle.
   * @param end Range end angle.
   * @returns Sub-ranges that stay on one side of the apex.
   */
  private rangeApexSplits(start: number, end: number): [number, number][] {
    if (end <= SHAPE_DRAW_ARCH_APEX_ANGLE || start >= SHAPE_DRAW_ARCH_APEX_ANGLE) {
      return [[start, end]];
    }
    return [
      [start, SHAPE_DRAW_ARCH_APEX_ANGLE],
      [SHAPE_DRAW_ARCH_APEX_ANGLE, end],
    ];
  }

  /**
   * Builds one extruded annular wedge between two angles.
   *
   * @param frame Arch frame.
   * @param start Wedge start angle.
   * @param end Wedge end angle.
   * @param innerSpan Inner ellipse radius along the span axis.
   * @param innerRise Inner ellipse radius along the up axis.
   * @returns Corner points of the wedge.
   */
  private wedgePointsCreate(
    frame: ShapeDrawArchFrame,
    start: number,
    end: number,
    innerSpan: number,
    innerRise: number,
  ): THREE.Vector3[] {
    return ShapeDrawShapeCircle.wedgePointsCreate({
      center: frame.center,
      firstAxis: frame.spanAxis,
      secondAxis: frame.upAxis,
      depthAxis: frame.extrudeAxis,
      angleStart: start,
      angleEnd: end,
      outerFirstRadius: frame.spanRadius,
      outerSecondRadius: frame.riseRadius,
      innerFirstRadius: innerSpan,
      innerSecondRadius: innerRise,
      depthNear: frame.extrudeNear,
      depthFar: frame.extrudeFar,
    });
  }

  /**
   * Builds one corner piece between an arc stretch and the bounds top edge.
   *
   * @param frame Arch frame.
   * @param start Stretch start angle on one side of the apex.
   * @param end Stretch end angle on one side of the apex.
   * @returns Corner points of the piece, or null when the stretch is
   *   degenerate.
   */
  private spandrelPiecePointsCreate(frame: ShapeDrawArchFrame, start: number, end: number): THREE.Vector3[] | null {
    const near = this.arcPointCreate(frame, start, frame.spanRadius, frame.riseRadius, frame.extrudeNear);
    const far = this.arcPointCreate(frame, end, frame.spanRadius, frame.riseRadius, frame.extrudeNear);
    if (Math.abs(far[frame.spanAxis] - near[frame.spanAxis]) <= SHAPE_DRAW_ARCH_FLAT_EPSILON) {
      return null;
    }
    const nearTop = this.heightPointCreate(near, frame, frame.top);
    const farTop = this.heightPointCreate(far, frame, frame.top);
    return [
      near,
      far,
      farTop,
      nearTop,
      this.depthPointCreate(near, frame),
      this.depthPointCreate(far, frame),
      this.depthPointCreate(farTop, frame),
      this.depthPointCreate(nearTop, frame),
    ];
  }

  /**
   * Places a point on the outer arc at one extrude depth.
   *
   * @param frame Arch frame.
   * @param angle Arc angle.
   * @param spanRadius Ellipse radius along the span axis.
   * @param riseRadius Ellipse radius along the up axis.
   * @param extrudeCoordinate Coordinate along the extrude axis.
   * @returns New arc point.
   */
  private arcPointCreate(
    frame: ShapeDrawArchFrame,
    angle: number,
    spanRadius: number,
    riseRadius: number,
    extrudeCoordinate: number,
  ): THREE.Vector3 {
    const point = ShapeDrawShapeCircle.pointCreate(
      frame.center,
      frame.spanAxis,
      spanRadius,
      frame.upAxis,
      riseRadius,
      angle,
    );
    point[frame.extrudeAxis] = extrudeCoordinate;
    return point;
  }

  /**
   * Copies a point up to a height on the up axis.
   *
   * @param point Point to copy.
   * @param frame Arch frame.
   * @param height Coordinate along the up axis.
   * @returns New point at the height.
   */
  private heightPointCreate(point: THREE.Vector3, frame: ShapeDrawArchFrame, height: number): THREE.Vector3 {
    const lifted = point.clone();
    lifted[frame.upAxis] = height;
    return lifted;
  }

  /**
   * Copies a point to the far extrude depth.
   *
   * @param point Point to copy.
   * @param frame Arch frame.
   * @returns New point at the far extrude coordinate.
   */
  private depthPointCreate(point: THREE.Vector3, frame: ShapeDrawArchFrame): THREE.Vector3 {
    const pushed = point.clone();
    pushed[frame.extrudeAxis] = frame.extrudeFar;
    return pushed;
  }
}

/** Axes, radii and depths one arch is built from. */
interface ShapeDrawArchFrame {
  /** Horizontal axis the arch spans. */
  spanAxis: ShapeDrawAxis;
  /** Horizontal axis the arch extrudes along. */
  extrudeAxis: ShapeDrawAxis;
  /** Axis the arch rises along. */
  upAxis: ShapeDrawAxis;
  /** Arc center point. */
  center: THREE.Vector3;
  /** Outer ellipse radius along the span axis. */
  spanRadius: number;
  /** Outer ellipse radius along the up axis. */
  riseRadius: number;
  /** Near coordinate along the extrude axis. */
  extrudeNear: number;
  /** Far coordinate along the extrude axis. */
  extrudeFar: number;
  /** Coordinate of the bounds top along the up axis. */
  top: number;
}
