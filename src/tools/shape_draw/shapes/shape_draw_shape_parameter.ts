/** One value a shape parameter can hold. */
export type ShapeDrawShapeParameterValue = number | string;

/** How a circle's first side sits relative to the frame axes. */
export type ShapeDrawCircleType = 'edge' | 'vertex';

/** Choice a selection parameter offers. */
export interface ShapeDrawParameterChoice {
  /** Value stored when the choice is picked. */
  value: string;
  /** Visible label. */
  label: string;
}

/** Numeric shape parameter description. */
export interface ShapeDrawNumberParameter {
  /** Discriminator. */
  kind: 'number';
  /** Stable parameter identifier. */
  id: string;
  /** Visible label. */
  label: string;
  /** Value used before the user changes anything. */
  defaultValue: number;
  /** Smallest value accepted. */
  minimum: number;
  /** Step used by numeric fields. */
  step: number;
}

/** Selection shape parameter description. */
export interface ShapeDrawChoiceParameter {
  /** Discriminator. */
  kind: 'choice';
  /** Stable parameter identifier. */
  id: string;
  /** Visible label. */
  label: string;
  /** Value used before the user changes anything. */
  defaultValue: string;
  /** Selectable values. */
  choices: ShapeDrawParameterChoice[];
}

/** Description of one shape parameter. */
export type ShapeDrawShapeParameter = ShapeDrawNumberParameter | ShapeDrawChoiceParameter;

/** Values keyed by parameter id. */
export type ShapeDrawShapeParameterValues = Record<string, ShapeDrawShapeParameterValue>;

/**
 * Returns a parameter's value, falling back to its default.
 *
 * @param parameter Parameter description.
 * @param values Values keyed by parameter id.
 * @returns Stored value or the parameter default.
 */
export function shapeDrawParameterValueResolve(
  parameter: ShapeDrawShapeParameter,
  values: ShapeDrawShapeParameterValues,
): ShapeDrawShapeParameterValue {
  const stored = values[parameter.id];
  if (stored !== undefined) {
    return stored;
  }
  return parameter.defaultValue;
}

/**
 * Returns a numeric parameter's value coerced to a finite number.
 *
 * @param parameter Numeric parameter description.
 * @param values Values keyed by parameter id.
 * @returns Finite value at least the parameter minimum.
 */
export function shapeDrawParameterNumberResolve(
  parameter: ShapeDrawNumberParameter,
  values: ShapeDrawShapeParameterValues,
): number {
  const resolved = shapeDrawParameterValueResolve(parameter, values);
  const numeric = typeof resolved === 'number' ? resolved : Number(resolved);
  if (!Number.isFinite(numeric)) {
    return parameter.defaultValue;
  }
  return Math.max(parameter.minimum, numeric);
}

/**
 * Returns an integer numeric parameter's value.
 *
 * @param parameter Numeric parameter description.
 * @param values Values keyed by parameter id.
 * @returns Integer value at least the parameter minimum.
 */
export function shapeDrawParameterIntegerResolve(
  parameter: ShapeDrawNumberParameter,
  values: ShapeDrawShapeParameterValues,
): number {
  return Math.max(1, Math.round(shapeDrawParameterNumberResolve(parameter, values)));
}
