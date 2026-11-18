import { shapeDrawAxesOtherThan, type ShapeDrawAxis } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import type { ShapeDrawChoiceParameter, ShapeDrawShapeParameterValue } from './shape_draw_shape_parameter.js';

/** Horizontal directions a rising shape (stairs, ramp) climbs toward. */
export type ShapeDrawDirection = '+x' | '-x' | '+z' | '-z';

/** Direction parameter descriptor shared by every rising shape. */
export const SHAPE_DRAW_DIRECTION_PARAMETER: ShapeDrawChoiceParameter = {
  kind: 'choice',
  id: 'direction',
  label: 'Direction',
  defaultValue: '+x',
  choices: [
    { value: '+x', label: '+X' },
    { value: '-x', label: '-X' },
    { value: '+z', label: '+Z' },
    { value: '-z', label: '-Z' },
  ],
};

/**
 * Returns the direction a stored parameter value names.
 *
 * @param value Stored parameter value.
 * @returns Direction, defaulting to +X.
 */
export function shapeDrawDirectionResolve(value: ShapeDrawShapeParameterValue | undefined): ShapeDrawDirection {
  if (value === '-x' || value === '+z' || value === '-z') {
    return value;
  }
  return '+x';
}

/**
 * Returns the flat axis a direction travels along for one up axis.
 *
 * @param upAxis Axis the shape rises along.
 * @param direction Climbing direction.
 * @returns Flat axis the shape climbs along.
 */
export function shapeDrawDirectionTravelAxisResolve(
  upAxis: ShapeDrawAxis,
  direction: ShapeDrawDirection,
): ShapeDrawAxis {
  const [firstFlat, secondFlat] = shapeDrawAxesOtherThan(upAxis);
  return direction === '+z' || direction === '-z' ? secondFlat : firstFlat;
}

/**
 * Returns the flat axis across a direction for one up axis.
 *
 * @param upAxis Axis the shape rises along.
 * @param travelAxis Flat axis the shape climbs along.
 * @returns The other flat axis.
 */
export function shapeDrawDirectionLateralAxisResolve(upAxis: ShapeDrawAxis, travelAxis: ShapeDrawAxis): ShapeDrawAxis {
  const [firstFlat, secondFlat] = shapeDrawAxesOtherThan(upAxis);
  return travelAxis === firstFlat ? secondFlat : firstFlat;
}

/**
 * Returns whether a direction climbs toward the positive end of its axis.
 *
 * @param direction Climbing direction.
 * @returns True for +X and +Z.
 */
export function shapeDrawDirectionAscending(direction: ShapeDrawDirection): boolean {
  return direction === '+x' || direction === '+z';
}
