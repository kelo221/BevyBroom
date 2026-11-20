import {
  PROCEDURAL_PART_ROLE_CAR,
  PROCEDURAL_PART_ROLE_SHAFT,
  proceduralPartRoleSet,
} from '@/procedural/build/procedural_part_role.js';
import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import {
  PROCEDURAL_PEOPLE_MOVER_PART_CAR,
  PROCEDURAL_PEOPLE_MOVER_SIZES as SIZES,
  PROCEDURAL_PEOPLE_MOVER_SLOT_CAR,
  PROCEDURAL_PEOPLE_MOVER_SLOT_FRAME,
} from '@/procedural/generator/people_mover/procedural_people_mover_dimensions.js';
import type { ProceduralPeopleMoverShape } from '@/procedural/generator/people_mover/procedural_people_mover_shape.js';

/** Run and across signs of the four shaft corner posts. */
const PROCEDURAL_PEOPLE_MOVER_POST_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * Builds an elevator: a square car standing on the low end, which the game
 * moves, and four corner posts of the shaft from the low end to above the high
 * end. The car and the posts are separate parts.
 */
export class ProceduralPeopleMoverBuilderElevator {
  /**
   * Builds the car and the shaft posts.
   *
   * @param shape Resolved elevator shape.
   * @param width Width of the square car.
   * @returns Car first, then the posts.
   */
  static build(shape: ProceduralPeopleMoverShape, width: number): ProceduralPart[] {
    const frame = new ProceduralPartFrame(shape.low, new THREE.Vector3(1, 0, 0));
    const half = width / 2;
    const car = frame.boxPart(PROCEDURAL_PEOPLE_MOVER_PART_CAR, PROCEDURAL_PEOPLE_MOVER_SLOT_CAR, {
      runFrom: -half,
      runTo: half,
      upFrom: 0,
      upTo: SIZES.carHeight,
      acrossFrom: -half,
      acrossTo: half,
    });
    const posts = ProceduralPeopleMoverBuilderElevator.postsBuild(frame, shape, half);
    return [
      proceduralPartRoleSet(car, PROCEDURAL_PART_ROLE_CAR),
      ...posts.map((post) => proceduralPartRoleSet(post, PROCEDURAL_PART_ROLE_SHAFT)),
    ];
  }

  /**
   * Builds the four shaft posts just outside the car's corners.
   *
   * @param frame Frame on the low end.
   * @param shape Resolved elevator shape.
   * @param half Half the car width.
   * @returns Post parts.
   */
  private static postsBuild(
    frame: ProceduralPartFrame,
    shape: ProceduralPeopleMoverShape,
    half: number,
  ): ProceduralPart[] {
    const top = shape.rise + SIZES.carHeight + SIZES.carHeadroom;
    const centerOffset = half + SIZES.postSize / 2;
    const postHalf = SIZES.postSize / 2;
    return PROCEDURAL_PEOPLE_MOVER_POST_CORNERS.map(([runSign, acrossSign], index) =>
      frame.boxPart(`Shaft Post ${index + 1}`, PROCEDURAL_PEOPLE_MOVER_SLOT_FRAME, {
        runFrom: runSign * centerOffset - postHalf,
        runTo: runSign * centerOffset + postHalf,
        upFrom: 0,
        upTo: top,
        acrossFrom: acrossSign * centerOffset - postHalf,
        acrossTo: acrossSign * centerOffset + postHalf,
      }),
    );
  }
}
