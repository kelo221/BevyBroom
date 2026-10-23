import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import type { ShapeDrawShapeRequest } from './shape_draw_shape.js';
import type { ShapeDrawShapeParameter } from './shape_draw_shape_parameter.js';
import { shapeDrawShapeBoxPointsCreate } from './shape_draw_shape_box.js';

/** The plain box brush shape. */
export class ShapeDrawShapeCuboid extends ShapeDrawShape {
  readonly id = 'cuboid';
  readonly label = 'Cuboid';
  readonly icon: IconName = 'cube-outline';

  /**
   * The cuboid has no parameters.
   *
   * @returns Empty descriptor list.
   */
  parameterDescriptors(): ShapeDrawShapeParameter[] {
    return [];
  }

  /**
   * Builds one box piece filling the bounds.
   *
   * @param request Bounds and parameter values.
   * @returns Corner points of the single box piece.
   */
  piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][] {
    return [shapeDrawShapeBoxPointsCreate(request.bounds.min, request.bounds.max)];
  }
}
