import * as THREE from 'three';
import { shapeDrawAxesOtherThan, type ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import type {
  ShapeDrawChoiceParameter,
  ShapeDrawCircleType,
  ShapeDrawNumberParameter,
} from './shape_draw_shape_parameter.js';

/** Shared side count parameter of round shapes. */
export const SHAPE_DRAW_ROUND_SIDES_PARAMETER: ShapeDrawNumberParameter = {
  kind: 'number',
  id: 'sides',
  label: 'Sides',
  defaultValue: 8,
  minimum: 3,
  step: 1,
};

/** Shared circle alignment parameter of round shapes. */
export const SHAPE_DRAW_ROUND_CIRCLE_TYPE_PARAMETER: ShapeDrawChoiceParameter = {
  kind: 'choice',
  id: 'circleType',
  label: 'Circle Type',
  defaultValue: 'edge',
  choices: [
    { value: 'edge', label: 'Edge Aligned' },
    { value: 'vertex', label: 'Vertex Aligned' },
  ],
};

/** Shared axis parameter of round shapes. */
export const SHAPE_DRAW_ROUND_AXIS_PARAMETER: ShapeDrawChoiceParameter = {
  kind: 'choice',
  id: 'axis',
  label: 'Axis',
  defaultValue: 'y',
  choices: [
    { value: 'x', label: 'X' },
    { value: 'y', label: 'Y' },
    { value: 'z', label: 'Z' },
  ],
};

/** Cross-section frame of a round shape inside its bounds. */
export interface ShapeDrawRoundFrame {
  /** Axis the round shape runs along. */
  axis: ShapeDrawAxis;
  /** First cross-section axis. */
  firstAxis: ShapeDrawAxis;
  /** Second cross-section axis. */
  secondAxis: ShapeDrawAxis;
  /** Center of the cross-section at the bounds center. */
  center: THREE.Vector3;
  /** Ellipse radius along the first axis. */
  firstRadius: number;
  /** Ellipse radius along the second axis. */
  secondRadius: number;
  /** Start coordinate along the run axis. */
  near: number;
  /** End coordinate along the run axis. */
  far: number;
}

/**
 * Fits an ellipse cross-section into the bounds perpendicular to a run axis.
 *
 * @param bounds Axis-aligned bounds.
 * @param axis Axis the round shape runs along.
 * @returns Cross-section frame.
 */
export function shapeDrawRoundFrameCreate(bounds: THREE.Box3, axis: ShapeDrawAxis): ShapeDrawRoundFrame {
  const [firstAxis, secondAxis] = shapeDrawAxesOtherThan(axis);
  const center = bounds.getCenter(new THREE.Vector3());
  return {
    axis,
    firstAxis,
    secondAxis,
    center,
    firstRadius: (bounds.max[firstAxis] - bounds.min[firstAxis]) * 0.5,
    secondRadius: (bounds.max[secondAxis] - bounds.min[secondAxis]) * 0.5,
    near: bounds.min[axis],
    far: bounds.max[axis],
  };
}

/**
 * Returns the stored circle alignment of a round shape.
 *
 * @param value Stored parameter value.
 * @returns Circle alignment, defaulting to edge aligned.
 */
export function shapeDrawRoundCircleTypeResolve(value: unknown): ShapeDrawCircleType {
  return value === 'vertex' ? 'vertex' : 'edge';
}

/**
 * Returns the stored run axis of a round shape.
 *
 * @param value Stored parameter value.
 * @returns Run axis, defaulting to Y.
 */
export function shapeDrawRoundAxisResolve(value: unknown): ShapeDrawAxis {
  if (value === 'x' || value === 'z') {
    return value;
  }
  return 'y';
}
