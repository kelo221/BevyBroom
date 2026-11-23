import * as THREE from 'three';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import type { ProceduralPeopleMoverTravel } from '@/procedural/generator/people_mover/procedural_people_mover_travel.js';

/** Sizes of the travel arrows drawn on a mover, in meters. */
export const PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES = {
  spacing: 1,
  length: 0.3,
  halfWidthMaximum: 0.4,
  halfWidthShare: 0.3,
  lift: 0.02,
} as const;

/**
 * Draws chevrons along a mover's walking line that point from its entry to its
 * exit, so the direction of travel can be seen in the viewports.
 */
export class ProceduralPeopleMoverTravelArrows {
  /**
   * Returns the line segments of the chevrons.
   *
   * @param travel Entry and exit of the mover.
   * @param width Width of the mover.
   * @returns Point pairs, two segments per chevron; empty when the ends meet.
   */
  static segmentsBuild(travel: ProceduralPeopleMoverTravel, width: number): THREE.Vector3[] {
    const along = new THREE.Vector3().subVectors(travel.exit, travel.entry);
    const length = along.length();
    if (length < PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES.length) {
      return [];
    }
    const count = Math.max(1, Math.floor(length / PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES.spacing));
    const forward = along.clone().divideScalar(length);
    const across = ProceduralPartFrame.acrossDirectionOf(forward).multiplyScalar(
      Math.min(
        width * PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES.halfWidthShare,
        PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES.halfWidthMaximum,
      ),
    );
    return Array.from({ length: count }, (_, index) =>
      ProceduralPeopleMoverTravelArrows.chevronSegments(
        travel.entry.clone().addScaledVector(forward, (length * (index + 0.5)) / count),
        forward,
        across,
      ),
    ).flat();
  }

  /**
   * Returns the two segments of one chevron whose tip points forward.
   *
   * @param center Middle of the chevron on the walking line.
   * @param forward Unit direction of travel.
   * @param across Half the chevron's width across the travel.
   * @returns Four points: left leg then right leg, each ending at the tip.
   */
  private static chevronSegments(
    center: THREE.Vector3,
    forward: THREE.Vector3,
    across: THREE.Vector3,
  ): THREE.Vector3[] {
    const lifted = center.clone().setY(center.y + PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES.lift);
    const halfLength = PROCEDURAL_PEOPLE_MOVER_ARROW_SIZES.length / 2;
    const tip = lifted.clone().addScaledVector(forward, halfLength);
    const tail = lifted.clone().addScaledVector(forward, -halfLength);
    return [tail.clone().add(across), tip, tail.clone().sub(across), tip.clone()];
  }
}
