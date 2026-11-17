import * as THREE from 'three';

/** What a people mover becomes, picked by the angle between its two ends. */
export type ProceduralPeopleMoverShapeKind = 'travelator' | 'escalator' | 'elevator' | 'too_steep' | 'too_short';

/** Steepest travelator, in degrees. */
export const PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES = 12;

/**
 * Steepest escalator, in degrees; steeper movers that are not vertical are
 * refused.
 */
export const PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES = 50;

/** Largest horizontal distance between the ends of an elevator, in meters. */
export const PROCEDURAL_PEOPLE_MOVER_ELEVATOR_MAX_RUN = 0.05;

/** Shortest distance between the ends of any mover, in meters. */
export const PROCEDURAL_PEOPLE_MOVER_MIN_LENGTH = 0.1;

/** The resolved shape of a people mover and its measures. */
export interface ProceduralPeopleMoverShape {
  readonly kind: ProceduralPeopleMoverShapeKind;
  readonly low: THREE.Vector3;
  readonly high: THREE.Vector3;
  readonly run: number;
  readonly rise: number;
  readonly length: number;
  readonly angleDegrees: number;
}

/**
 * Works out what a people mover is from its two ends: a travelator up to 12°,
 * an escalator up to 50°, an elevator when the ends lie on one plumb line, and
 * refused in between or when the ends nearly meet.
 */
export class ProceduralPeopleMoverShapeResolver {
  /**
   * Resolves the shape between two ends.
   *
   * @param start First end in owner space.
   * @param end Second end in owner space.
   * @returns Shape with the low and high end, run, rise, length and angle.
   */
  static resolve(start: THREE.Vector3, end: THREE.Vector3): ProceduralPeopleMoverShape {
    const isEndLower = end.y < start.y;
    const low = (isEndLower ? end : start).clone();
    const high = (isEndLower ? start : end).clone();
    const run = Math.hypot(high.x - low.x, high.z - low.z);
    const rise = high.y - low.y;
    const length = Math.hypot(run, rise);
    const angleDegrees = THREE.MathUtils.radToDeg(Math.atan2(rise, run));
    const kind = ProceduralPeopleMoverShapeResolver.kindOf(run, length, angleDegrees);
    return { kind, low, high, run, rise, length, angleDegrees };
  }

  /**
   * Picks the shape kind from the measures.
   *
   * @param run Horizontal distance between the ends.
   * @param length Distance between the ends.
   * @param angleDegrees Angle above the horizontal.
   * @returns Shape kind.
   */
  private static kindOf(run: number, length: number, angleDegrees: number): ProceduralPeopleMoverShapeKind {
    if (length < PROCEDURAL_PEOPLE_MOVER_MIN_LENGTH) {
      return 'too_short';
    }
    if (run < PROCEDURAL_PEOPLE_MOVER_ELEVATOR_MAX_RUN) {
      return 'elevator';
    }
    if (angleDegrees <= PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES) {
      return 'travelator';
    }
    return angleDegrees <= PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES ? 'escalator' : 'too_steep';
  }
}
