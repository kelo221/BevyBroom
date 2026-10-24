import * as THREE from 'three';
import type { IconName } from '@/ui/icons/icon_name.js';
import type { ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import type { ShapeDrawShapeParameter, ShapeDrawShapeParameterValues } from './shape_draw_shape_parameter.js';

/** Everything one shape needs to build its pieces. */
export interface ShapeDrawShapeRequest {
  /** Axis-aligned bounds the shape must fit into. */
  bounds: THREE.Box3;
  /** Parameter values keyed by parameter id. */
  parameters: ShapeDrawShapeParameterValues;
  /** Axis pointing up in the request frame (the working grid normal). */
  upAxis: ShapeDrawAxis;
}

/**
 * A drawable brush shape. Subclasses list their parameters and turn the given
 * bounds into one or more convex point sets; every piece must be a convex
 * closed solid because brushes stay convex.
 */
export abstract class ShapeDrawShape {
  /** Stable shape identifier used by settings, scenes and tools. */
  abstract readonly id: string;
  /** Visible shape name. */
  abstract readonly label: string;
  /** Icon shown in menus and the options bar. */
  abstract readonly icon: IconName;

  /**
   * Describes every parameter of this shape in display order.
   *
   * @returns Parameter descriptors.
   */
  abstract parameterDescriptors(): ShapeDrawShapeParameter[];

  /**
   * Builds the convex point sets of this shape fitted into the bounds.
   *
   * @param request Bounds, parameter values and the up axis.
   * @returns One point set per convex piece; empty when the bounds are flat.
   */
  abstract piecesCreate(request: ShapeDrawShapeRequest): THREE.Vector3[][];
}
