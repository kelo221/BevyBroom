import {
  PROCEDURAL_PART_ROLE_DECK,
  PROCEDURAL_PART_ROLE_SIDE,
  PROCEDURAL_PART_ROLE_STEP,
  proceduralPartRoleSet,
} from '@/procedural/build/procedural_part_role.js';
import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import {
  PROCEDURAL_PEOPLE_MOVER_SIZES as SIZES,
  PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS,
  PROCEDURAL_PEOPLE_MOVER_SLOT_RAILS,
  PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD,
} from '@/procedural/generator/people_mover/procedural_people_mover_dimensions.js';
import type { ProceduralPeopleMoverShape } from '@/procedural/generator/people_mover/procedural_people_mover_shape.js';

/** The two sides of a mover, with the sign of their across offset. */
const PROCEDURAL_PEOPLE_MOVER_SIDES: readonly (readonly [string, number])[] = [
  ['Left', -1],
  ['Right', 1],
];

/**
 * Builds the convex parts of a travelator or an escalator in a frame running
 * from its low end to its high end: a belt or steps, a landing plate at each
 * end, and a side panel with a handrail on each side.
 */
export class ProceduralPeopleMoverBuilderIncline {
  /**
   * Builds a travelator: a sloped belt between the landings.
   *
   * @param shape Resolved travelator shape.
   * @param width Width between the panels.
   * @returns Parts in a stable order.
   */
  static travelatorBuild(shape: ProceduralPeopleMoverShape, width: number): ProceduralPart[] {
    const frame = ProceduralPeopleMoverBuilderIncline.frameOf(shape);
    const half = width / 2;
    const belt = proceduralPartRoleSet(
      frame.boxPart(
        'Belt',
        PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD,
        { runFrom: 0, runTo: shape.run, upFrom: -SIZES.beltThickness, upTo: 0, acrossFrom: -half, acrossTo: half },
        shape.rise / shape.run,
      ),
      PROCEDURAL_PART_ROLE_DECK,
    );
    return [belt, ...ProceduralPeopleMoverBuilderIncline.sharedPartsBuild(frame, shape, width, SIZES.beltThickness)];
  }

  /**
   * Builds an escalator: level steps on a sloped truss between the landings.
   *
   * @param shape Resolved escalator shape.
   * @param width Width between the panels.
   * @returns Parts in a stable order.
   */
  static escalatorBuild(shape: ProceduralPeopleMoverShape, width: number): ProceduralPart[] {
    const frame = ProceduralPeopleMoverBuilderIncline.frameOf(shape);
    const half = width / 2;
    const truss = proceduralPartRoleSet(
      frame.boxPart(
        'Truss',
        PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS,
        { runFrom: 0, runTo: shape.run, upFrom: -SIZES.trussDepth, upTo: 0, acrossFrom: -half, acrossTo: half },
        shape.rise / shape.run,
      ),
      PROCEDURAL_PART_ROLE_DECK,
    );
    const steps = ProceduralPeopleMoverBuilderIncline.stepsBuild(frame, shape, half);
    return [
      truss,
      ...steps,
      ...ProceduralPeopleMoverBuilderIncline.sharedPartsBuild(frame, shape, width, SIZES.trussDepth),
    ];
  }

  /**
   * Returns how many steps an escalator of a rise has: the fewest steps whose
   * risers stay within the largest riser.
   *
   * @param rise Height between the ends.
   * @returns Step count, at least one.
   */
  static stepCountOf(rise: number): number {
    return Math.max(1, Math.ceil(rise / SIZES.stepRiserMax - 1e-9));
  }

  /**
   * Builds the level steps, each sitting with its front edge on the slope.
   *
   * @param frame Frame from the low end toward the high end.
   * @param shape Resolved escalator shape.
   * @param half Half the width.
   * @returns Step parts from the bottom up.
   */
  private static stepsBuild(
    frame: ProceduralPartFrame,
    shape: ProceduralPeopleMoverShape,
    half: number,
  ): ProceduralPart[] {
    const count = ProceduralPeopleMoverBuilderIncline.stepCountOf(shape.rise);
    const tread = shape.run / count;
    const riser = shape.rise / count;
    const steps: ProceduralPart[] = [];
    for (let index = 0; index < count; index++) {
      const step = frame.boxPart(`Step ${index + 1}`, PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD, {
        runFrom: index * tread,
        runTo: (index + 1) * tread,
        upFrom: index * riser,
        upTo: (index + 1) * riser,
        acrossFrom: -half,
        acrossTo: half,
      });
      steps.push(proceduralPartRoleSet(step, PROCEDURAL_PART_ROLE_STEP));
    }
    return steps;
  }

  /**
   * Builds the parts both inclines share: the landings, side panels and
   * handrails.
   *
   * @param frame Frame from the low end toward the high end.
   * @param shape Resolved shape.
   * @param width Width between the panels.
   * @param depth How far the panels reach below the slope.
   * @returns Shared parts.
   */
  private static sharedPartsBuild(
    frame: ProceduralPartFrame,
    shape: ProceduralPeopleMoverShape,
    width: number,
    depth: number,
  ): ProceduralPart[] {
    return [
      ...ProceduralPeopleMoverBuilderIncline.landingsBuild(frame, shape, width / 2),
      ...PROCEDURAL_PEOPLE_MOVER_SIDES.flatMap(([side, sign]) =>
        ProceduralPeopleMoverBuilderIncline.sideBuild(frame, shape, { side, sign, half: width / 2, depth }),
      ),
    ];
  }

  /**
   * Builds the level landing plates beyond both ends, their tops at the ends.
   *
   * @param frame Frame from the low end toward the high end.
   * @param shape Resolved shape.
   * @param half Half the width.
   * @returns Low and high landing parts.
   */
  private static landingsBuild(
    frame: ProceduralPartFrame,
    shape: ProceduralPeopleMoverShape,
    half: number,
  ): ProceduralPart[] {
    const across = { acrossFrom: -half, acrossTo: half };
    const low = { runFrom: -SIZES.landingLength, runTo: 0, upFrom: -SIZES.landingThickness, upTo: 0, ...across };
    const high = {
      runFrom: shape.run,
      runTo: shape.run + SIZES.landingLength,
      upFrom: shape.rise - SIZES.landingThickness,
      upTo: shape.rise,
      ...across,
    };
    return [
      frame.boxPart('Landing Low', PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD, low),
      frame.boxPart('Landing High', PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD, high),
    ].map((landing) => proceduralPartRoleSet(landing, PROCEDURAL_PART_ROLE_DECK));
  }

  /**
   * Builds the sloped side panel and the handrail on top of it on one side.
   *
   * @param frame Frame from the low end toward the high end.
   * @param shape Resolved shape.
   * @param placement Side name, across sign, half width and panel depth.
   * @returns Panel and handrail parts.
   */
  private static sideBuild(
    frame: ProceduralPartFrame,
    shape: ProceduralPeopleMoverShape,
    placement: { side: string; sign: number; half: number; depth: number },
  ): ProceduralPart[] {
    const slope = shape.rise / shape.run;
    const inner = placement.sign * placement.half;
    const outer = placement.sign * (placement.half + SIZES.panelThickness);
    const railMiddle = (inner + outer) / 2;
    const run = { runFrom: 0, runTo: shape.run };
    const panel = {
      ...run,
      upFrom: -placement.depth,
      upTo: SIZES.panelHeight,
      ...ProceduralPeopleMoverBuilderIncline.spanOf(inner, outer),
    };
    const railAcross = ProceduralPeopleMoverBuilderIncline.spanOf(
      railMiddle - SIZES.railWidth / 2,
      railMiddle + SIZES.railWidth / 2,
    );
    const rail = { ...run, upFrom: SIZES.panelHeight, upTo: SIZES.panelHeight + SIZES.railHeight, ...railAcross };
    return [
      frame.boxPart(`Panel ${placement.side}`, PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS, panel, slope),
      frame.boxPart(`Handrail ${placement.side}`, PROCEDURAL_PEOPLE_MOVER_SLOT_RAILS, rail, slope),
    ].map((sidePart) => proceduralPartRoleSet(sidePart, PROCEDURAL_PART_ROLE_SIDE));
  }

  /**
   * Returns an across extent between two offsets in either order.
   *
   * @param first One offset.
   * @param second The other offset.
   * @returns Across extent.
   */
  private static spanOf(first: number, second: number): { acrossFrom: number; acrossTo: number } {
    return { acrossFrom: Math.min(first, second), acrossTo: Math.max(first, second) };
  }

  /**
   * Returns the frame from the low end toward the high end.
   *
   * @param shape Resolved shape.
   * @returns Build frame.
   */
  private static frameOf(shape: ProceduralPeopleMoverShape): ProceduralPartFrame {
    return new ProceduralPartFrame(shape.low, new THREE.Vector3().subVectors(shape.high, shape.low));
  }
}
