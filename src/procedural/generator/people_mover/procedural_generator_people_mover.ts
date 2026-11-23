import * as THREE from 'three';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import { ProceduralPeopleMoverBuilderElevator } from '@/procedural/generator/people_mover/procedural_people_mover_builder_elevator.js';
import { ProceduralPeopleMoverBuilderIncline } from '@/procedural/generator/people_mover/procedural_people_mover_builder_incline.js';
import {
  PROCEDURAL_PEOPLE_MOVER_SIZES as SIZES,
  PROCEDURAL_PEOPLE_MOVER_SLOT_CAR,
  PROCEDURAL_PEOPLE_MOVER_SLOT_FRAME,
  PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS,
  PROCEDURAL_PEOPLE_MOVER_SLOT_RAILS,
  PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD,
} from '@/procedural/generator/people_mover/procedural_people_mover_dimensions.js';
import {
  PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES,
  PROCEDURAL_PEOPLE_MOVER_MIN_LENGTH,
  type ProceduralPeopleMoverShape,
  ProceduralPeopleMoverShapeResolver,
} from '@/procedural/generator/people_mover/procedural_people_mover_shape.js';
import {
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START,
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
  PROCEDURAL_PEOPLE_MOVER_DIRECTIONS,
  type ProceduralPeopleMoverTravel,
  ProceduralPeopleMoverTravelResolver,
} from '@/procedural/generator/people_mover/procedural_people_mover_travel.js';
import { ProceduralPeopleMoverTravelArrows } from '@/procedural/generator/people_mover/procedural_people_mover_travel_arrows.js';
import {
  ProceduralGenerator,
  type ProceduralHandleSpanDefinition,
  type ProceduralMaterialSlot,
} from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Identifier of the people mover generator. */
export const PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID = 'people_mover';

/** Field path of the first end. */
export const PROCEDURAL_PEOPLE_MOVER_START = 'start';

/** Field path of the second end. */
export const PROCEDURAL_PEOPLE_MOVER_END = 'end';

/** Field path of the width. */
export const PROCEDURAL_PEOPLE_MOVER_WIDTH = 'width';

/** Field path of the direction people are carried in. */
export const PROCEDURAL_PEOPLE_MOVER_DIRECTION = 'direction';

/** Field path of the belt speed. */
export const PROCEDURAL_PEOPLE_MOVER_SPEED = 'speed';

/**
 * Field path of the signed belt speed of parameter layout version 1, positive
 * toward the high end; it is also the derived value the game reads.
 */
export const PROCEDURAL_PEOPLE_MOVER_BELT = 'belt';

/** Fields of a people mover. */
const PROCEDURAL_PEOPLE_MOVER_FIELDS: readonly GameEntityField[] = [
  { path: PROCEDURAL_PEOPLE_MOVER_START, label: 'Start', kind: 'vector3', default: [0, 0, 0] },
  { path: PROCEDURAL_PEOPLE_MOVER_END, label: 'End', kind: 'vector3', default: [6, 3, 0] },
  {
    path: PROCEDURAL_PEOPLE_MOVER_WIDTH,
    label: 'Width',
    kind: 'number',
    default: 1.2,
    minimum: 0.4,
    maximum: 6,
    step: 0.1,
  },
  {
    path: PROCEDURAL_PEOPLE_MOVER_DIRECTION,
    label: 'Direction',
    kind: 'enum',
    default: PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
    variants: [...PROCEDURAL_PEOPLE_MOVER_DIRECTIONS],
    variant_details: {
      [PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END]: { label: 'Start to End' },
      [PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START]: { label: 'End to Start' },
    },
  },
  {
    path: PROCEDURAL_PEOPLE_MOVER_SPEED,
    label: 'Belt Speed (m/s)',
    kind: 'number',
    default: 3,
    minimum: 0,
    maximum: 10,
    step: 0.1,
  },
];

/** Derived values that are points: the low, high, entry and exit end. */
const PROCEDURAL_PEOPLE_MOVER_DERIVED_POINTS: readonly string[] = ['low_end', 'high_end', 'entry_end', 'exit_end'];

/** Material slots of a people mover. */
const PROCEDURAL_PEOPLE_MOVER_SLOTS: readonly ProceduralMaterialSlot[] = [
  { name: PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD, label: 'Tread' },
  { name: PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS, label: 'Panels' },
  { name: PROCEDURAL_PEOPLE_MOVER_SLOT_RAILS, label: 'Rails' },
  { name: PROCEDURAL_PEOPLE_MOVER_SLOT_CAR, label: 'Car' },
  { name: PROCEDURAL_PEOPLE_MOVER_SLOT_FRAME, label: 'Shaft' },
];

/** The width handle, across the line between the ends. */
const PROCEDURAL_PEOPLE_MOVER_SPANS: readonly ProceduralHandleSpanDefinition[] = [
  {
    path: PROCEDURAL_PEOPLE_MOVER_WIDTH,
    lineStartPath: PROCEDURAL_PEOPLE_MOVER_START,
    lineEndPath: PROCEDURAL_PEOPLE_MOVER_END,
  },
];

/**
 * A prop that carries people between two ends: a travelator when the slope is
 * gentle, an escalator with steps when it is steeper, and an elevator when the
 * ends are on one plumb line. The direction picks which end people step on; the
 * belt speed is in meters per second.
 */
export class ProceduralGeneratorPeopleMover extends ProceduralGenerator {
  readonly generatorId: string = PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID;
  readonly label = 'People Mover';
  readonly version = 2;
  readonly iconName: IconName = 'shape-stairs';

  /**
   * Returns the ends, width and belt speed fields.
   *
   * @returns Field descriptions.
   */
  fields(): readonly GameEntityField[] {
    return PROCEDURAL_PEOPLE_MOVER_FIELDS;
  }

  /**
   * Returns the tread, panel, rail, car and shaft slots.
   *
   * @returns Material slots.
   */
  materialSlots(): readonly ProceduralMaterialSlot[] {
    return PROCEDURAL_PEOPLE_MOVER_SLOTS;
  }

  /**
   * Shows both ends as handles.
   *
   * @returns End field paths.
   */
  override handlePointPaths(): readonly string[] {
    return [PROCEDURAL_PEOPLE_MOVER_START, PROCEDURAL_PEOPLE_MOVER_END];
  }

  /**
   * Shows the width as a handle beside the middle of the mover.
   *
   * @returns The width span.
   */
  override handleSpans(): readonly ProceduralHandleSpanDefinition[] {
    return PROCEDURAL_PEOPLE_MOVER_SPANS;
  }

  /**
   * Builds the parts of the resolved shape; refused shapes build nothing.
   *
   * @param parameters Valid parameters.
   * @returns Parts in a stable order.
   */
  partsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    const shape = ProceduralGeneratorPeopleMover.shapeOf(parameters);
    const width = ProceduralParametersRead.number(parameters, PROCEDURAL_PEOPLE_MOVER_WIDTH);
    if (shape.kind === 'travelator') {
      return ProceduralPeopleMoverBuilderIncline.travelatorBuild(shape, width);
    }
    if (shape.kind === 'escalator') {
      return ProceduralPeopleMoverBuilderIncline.escalatorBuild(shape, width);
    }
    return shape.kind === 'elevator' ? ProceduralPeopleMoverBuilderElevator.build(shape, width) : [];
  }

  /**
   * Returns the shape and measures the game reads instead of working them out.
   *
   * @param parameters Valid parameters.
   * @returns Shape, run, rise, length, angle, step count, the belt speed signed
   *   toward the high end, and the local low, high, entry and exit ends.
   */
  override derivedValues(parameters: ProceduralParameters): ProceduralParameters {
    const shape = ProceduralGeneratorPeopleMover.shapeOf(parameters);
    const travel = ProceduralGeneratorPeopleMover.travelOf(parameters);
    return {
      shape: shape.kind,
      run: shape.run,
      rise: shape.rise,
      length: shape.length,
      angle_degrees: shape.angleDegrees,
      step_count: shape.kind === 'escalator' ? ProceduralPeopleMoverBuilderIncline.stepCountOf(shape.rise) : 0,
      low_end: ProceduralParametersRead.vector3Value(shape.low),
      high_end: ProceduralParametersRead.vector3Value(shape.high),
      [PROCEDURAL_PEOPLE_MOVER_BELT]: travel.beltTowardHigh,
      entry_end: ProceduralParametersRead.vector3Value(travel.entry),
      exit_end: ProceduralParametersRead.vector3Value(travel.exit),
    };
  }

  /**
   * Turns the signed belt speed of layout version 1, positive toward the high
   * end, into a direction and an unsigned speed.
   *
   * @param candidate Untrusted parameters of layout version 1.
   * @param fromVersion Layout version the candidate was written for.
   * @returns Untrusted parameters in the current layout.
   */
  override parametersMigrate(
    candidate: Readonly<Record<string, unknown>>,
    fromVersion: number,
  ): Record<string, unknown> {
    const { [PROCEDURAL_PEOPLE_MOVER_BELT]: belt, ...rest } = candidate;
    if (fromVersion >= 2 || typeof belt !== 'number' || !Number.isFinite(belt)) {
      return { ...rest };
    }
    const ends = this.parametersSanitize(rest);
    const direction = ProceduralPeopleMoverTravelResolver.directionOfBelt(
      ProceduralParametersRead.vector3(ends, PROCEDURAL_PEOPLE_MOVER_START),
      ProceduralParametersRead.vector3(ends, PROCEDURAL_PEOPLE_MOVER_END),
      belt,
    );
    return { ...rest, [PROCEDURAL_PEOPLE_MOVER_DIRECTION]: direction, [PROCEDURAL_PEOPLE_MOVER_SPEED]: Math.abs(belt) };
  }

  /**
   * Draws chevrons that point the way the mover carries people.
   *
   * @param parameters Valid parameters.
   * @returns Chevron segments; none for a refused mover.
   */
  override guideSegmentsBuild(parameters: ProceduralParameters): THREE.Vector3[] {
    if (this.issuesDescribe(parameters).length > 0) {
      return [];
    }
    const width = ProceduralParametersRead.number(parameters, PROCEDURAL_PEOPLE_MOVER_WIDTH);
    return ProceduralPeopleMoverTravelArrows.segmentsBuild(ProceduralGeneratorPeopleMover.travelOf(parameters), width);
  }

  /**
   * Names the low, high, entry and exit ends as points.
   *
   * @returns Derived point names.
   */
  override derivedPointNames(): readonly string[] {
    return PROCEDURAL_PEOPLE_MOVER_DERIVED_POINTS;
  }

  /**
   * Explains why a mover is refused.
   *
   * @param parameters Valid parameters.
   * @returns The problem of a too steep or too short mover, else nothing.
   */
  override issuesDescribe(parameters: ProceduralParameters): string[] {
    const shape = ProceduralGeneratorPeopleMover.shapeOf(parameters);
    if (shape.kind === 'too_steep') {
      const angle = shape.angleDegrees.toFixed(1);
      return [
        `People mover is ${angle}° steep: escalators go up to ${PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES}°, ` +
          'and an elevator needs both ends on one plumb line',
      ];
    }
    if (shape.kind === 'too_short') {
      return [`People mover ends are closer than ${PROCEDURAL_PEOPLE_MOVER_MIN_LENGTH} m`];
    }
    return [];
  }

  /**
   * Shows a refused mover as a thin rod between its ends.
   *
   * @param parameters Valid parameters.
   * @returns The rod, or the default cube when the ends nearly meet.
   */
  override placeholderPartsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    const shape = ProceduralGeneratorPeopleMover.shapeOf(parameters);
    if (shape.kind === 'too_short' || shape.run <= 0) {
      return super.placeholderPartsBuild(parameters);
    }
    const frame = new ProceduralPartFrame(shape.low, new THREE.Vector3().subVectors(shape.high, shape.low));
    const radius = SIZES.placeholderRadius;
    const rod = { runFrom: 0, runTo: shape.run, upFrom: -radius, upTo: radius, acrossFrom: -radius, acrossTo: radius };
    return [frame.boxPart('Placeholder', PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS, rod, shape.rise / shape.run)];
  }

  /**
   * Resolves where the mover carries people.
   *
   * @param parameters Valid parameters.
   * @returns Entry, exit and signed belt speed.
   */
  private static travelOf(parameters: ProceduralParameters): ProceduralPeopleMoverTravel {
    return ProceduralPeopleMoverTravelResolver.resolve(
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_PEOPLE_MOVER_START),
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_PEOPLE_MOVER_END),
      ProceduralParametersRead.text(parameters, PROCEDURAL_PEOPLE_MOVER_DIRECTION),
      ProceduralParametersRead.number(parameters, PROCEDURAL_PEOPLE_MOVER_SPEED),
    );
  }

  /**
   * Resolves the shape between the two ends.
   *
   * @param parameters Valid parameters.
   * @returns Resolved shape.
   */
  private static shapeOf(parameters: ProceduralParameters): ProceduralPeopleMoverShape {
    return ProceduralPeopleMoverShapeResolver.resolve(
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_PEOPLE_MOVER_START),
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_PEOPLE_MOVER_END),
    );
  }
}
