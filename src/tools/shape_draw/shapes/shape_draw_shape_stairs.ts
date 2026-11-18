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
  type ShapeDrawDirection,
} from './shape_draw_shape_direction.js';
import { shapeDrawShapeBoxPieceCreate } from './shape_draw_shape_box.js';
import type { ShapeDrawSurfacePieceMapping } from '@/tools/shape_draw/surface/piece_mapping/shape_draw_surface_piece_mapping.js';
import { ShapeDrawSurfacePieceMappingIndex } from '@/tools/shape_draw/surface/piece_mapping/shape_draw_surface_piece_mapping_index.js';

/** Default step height in world units (two default grid steps). */
export const SHAPE_DRAW_STAIRS_DEFAULT_STEP_HEIGHT = 0.5;

/** Smallest step height accepted. */
const SHAPE_DRAW_STAIRS_MINIMUM_STEP_HEIGHT = 0.01;

/** Extent below which the bounds count as flat along an axis. */
const SHAPE_DRAW_STAIRS_FLAT_EPSILON = 1e-6;

/** Step height parameter descriptor. */
const SHAPE_DRAW_STAIRS_STEP_HEIGHT_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'stepHeight',
  label: 'Step Height',
  defaultValue: SHAPE_DRAW_STAIRS_DEFAULT_STEP_HEIGHT,
  minimum: SHAPE_DRAW_STAIRS_MINIMUM_STEP_HEIGHT,
  step: 0.25,
};

/** Stairs made of stacked box steps with equal treads. */
export class ShapeDrawShapeStairs extends ShapeDrawShape {
  readonly id = 'stairs';
  readonly label = 'Stairs';
  readonly icon: IconName = 'shape-stairs';

  /**
   * Describes the step height and the running direction.
   *
   * @returns Parameter descriptors.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [SHAPE_DRAW_STAIRS_STEP_HEIGHT_PARAMETER, SHAPE_DRAW_DIRECTION_PARAMETER];
  }

  /**
   * Maps regenerated steps by step order so the first and top steps keep their
   * surfaces and added steps look like the top step.
   *
   * @returns Index piece mapping.
   */
  override surfacePieceMappingCreate(): ShapeDrawSurfacePieceMapping {
    return new ShapeDrawSurfacePieceMappingIndex();
  }

  /**
   * Builds one box piece per step; the step count is the bounds height divided
   * by the step height rounded up, treads split the horizontal run equally and
   * every step spans from the bounds floor so all treads are equal.
   *
   * @param request Bounds, parameter values and the up axis.
   * @returns Corner points of every step, or an empty list when flat.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    const height = request.bounds.max[request.upAxis] - request.bounds.min[request.upAxis];
    if (height <= SHAPE_DRAW_STAIRS_FLAT_EPSILON) {
      return [];
    }
    const stepHeight = shapeDrawParameterNumberResolve(SHAPE_DRAW_STAIRS_STEP_HEIGHT_PARAMETER, request.parameters);
    const stepCount = Math.max(1, Math.ceil(height / stepHeight - 1e-9));
    return this.stepPiecesCreate(request, stepCount);
  }

  /**
   * Builds the corner points of every step.
   *
   * @param request Bounds, parameter values and the up axis.
   * @param stepCount Number of steps.
   * @returns Corner points of every step.
   */
  private stepPiecesCreate(request: ShapeDrawShapeRequest, stepCount: number): THREE.Vector3[][] {
    const direction = shapeDrawDirectionResolve(request.parameters['direction']);
    const travelAxis = shapeDrawDirectionTravelAxisResolve(request.upAxis, direction);
    const lateralAxis = shapeDrawDirectionLateralAxisResolve(request.upAxis, travelAxis);
    const run = request.bounds.max[travelAxis] - request.bounds.min[travelAxis];
    const floor = request.bounds.min[request.upAxis];
    const ceiling = request.bounds.max[request.upAxis];
    const pieces: THREE.Vector3[][] = [];
    for (let step = 0; step < stepCount; step += 1) {
      const top = floor + ((step + 1) * (ceiling - floor)) / stepCount;
      const span = this.stepSpanResolve(request.bounds, travelAxis, direction, run / stepCount, step);
      pieces.push(
        shapeDrawShapeBoxPieceCreate(
          [travelAxis, lateralAxis, request.upAxis],
          [span, [request.bounds.min[lateralAxis], request.bounds.max[lateralAxis]], [floor, top]],
        ),
      );
    }
    return pieces;
  }

  /**
   * Returns the horizontal span of one step along the travel axis.
   *
   * @param bounds Bounds the stairs fit into.
   * @param travelAxis Horizontal axis the treads run along.
   * @param direction Running direction of the treads.
   * @param tread Tread length.
   * @param step Zero-based step index.
   * @returns Start and end coordinate of the tread.
   */
  private stepSpanResolve(
    bounds: THREE.Box3,
    travelAxis: ShapeDrawAxis,
    direction: ShapeDrawDirection,
    tread: number,
    step: number,
  ): [number, number] {
    const start = shapeDrawDirectionAscending(direction)
      ? bounds.min[travelAxis] + step * tread
      : bounds.max[travelAxis] - (step + 1) * tread;
    return [start, start + tread];
  }
}
