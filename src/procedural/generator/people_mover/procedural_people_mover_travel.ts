import * as THREE from 'three';

/** Direction value of a mover that carries people from its start to its end. */
export const PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END = 'start_to_end';

/** Direction value of a mover that carries people from its end to its start. */
export const PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START = 'end_to_start';

/** Every direction value, in menu order. */
export const PROCEDURAL_PEOPLE_MOVER_DIRECTIONS: readonly string[] = [
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START,
];

/** Where a mover carries people and how fast. */
export interface ProceduralPeopleMoverTravel {
  /** End people step on, in owner space. */
  readonly entry: THREE.Vector3;
  /** End people step off, in owner space. */
  readonly exit: THREE.Vector3;
  /** Belt speed in meters per second, positive when it runs toward the high end. */
  readonly beltTowardHigh: number;
}

/**
 * Works out the travel of a people mover from its two ends, its direction and
 * its speed, and turns the older signed belt speed into a direction.
 */
export class ProceduralPeopleMoverTravelResolver {
  /**
   * Resolves the travel of a mover.
   *
   * @param start Start end in owner space.
   * @param end End end in owner space.
   * @param direction Direction value, such as
   *   {@link PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END}.
   * @param speed Belt speed in meters per second, zero or more.
   * @returns Entry, exit and the belt speed signed toward the high end.
   */
  static resolve(
    start: THREE.Vector3,
    end: THREE.Vector3,
    direction: string,
    speed: number,
  ): ProceduralPeopleMoverTravel {
    const isTowardEnd = direction !== PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START;
    const isTowardHigh = isTowardEnd === ProceduralPeopleMoverTravelResolver.endIsHigh(start, end);
    return {
      entry: (isTowardEnd ? start : end).clone(),
      exit: (isTowardEnd ? end : start).clone(),
      beltTowardHigh: isTowardHigh ? speed : -speed,
    };
  }

  /**
   * Returns the direction a belt speed signed toward the high end runs in.
   *
   * @param start Start end in owner space.
   * @param end End end in owner space.
   * @param beltTowardHigh Belt speed, positive toward the high end.
   * @returns Direction value.
   */
  static directionOfBelt(start: THREE.Vector3, end: THREE.Vector3, beltTowardHigh: number): string {
    const isTowardHigh = beltTowardHigh >= 0;
    return isTowardHigh === ProceduralPeopleMoverTravelResolver.endIsHigh(start, end)
      ? PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END
      : PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START;
  }

  /**
   * Returns whether the end is the high end; on level ends the end counts as
   * high.
   *
   * @param start Start end.
   * @param end End end.
   * @returns True unless the end lies below the start.
   */
  static endIsHigh(start: THREE.Vector3, end: THREE.Vector3): boolean {
    return end.y >= start.y;
  }
}
