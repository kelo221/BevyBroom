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

/** Field path of the belt speed. */
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
    path: PROCEDURAL_PEOPLE_MOVER_BELT,
    label: 'Belt Speed',
    kind: 'number',
    default: 0.5,
    minimum: -10,
    maximum: 10,
    step: 0.1,
  },
];

/** Derived values that are points: the low and the high end. */
const PROCEDURAL_PEOPLE_MOVER_DERIVED_POINTS: readonly string[] = ['low_end', 'high_end'];

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
 * ends are on one plumb line. Belt speed is in meters per second, positive
 * toward the high end.
 */
export class ProceduralGeneratorPeopleMover extends ProceduralGenerator {
  readonly generatorId: string = PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID;
  readonly label = 'People Mover';
  readonly version = 1;
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
   * @returns Shape, run, rise, length, angle, step count and the local low and
   *   high ends.
   */
  override derivedValues(parameters: ProceduralParameters): ProceduralParameters {
    const shape = ProceduralGeneratorPeopleMover.shapeOf(parameters);
    return {
      shape: shape.kind,
      run: shape.run,
      rise: shape.rise,
      length: shape.length,
      angle_degrees: shape.angleDegrees,
      step_count: shape.kind === 'escalator' ? ProceduralPeopleMoverBuilderIncline.stepCountOf(shape.rise) : 0,
      low_end: ProceduralParametersRead.vector3Value(shape.low),
      high_end: ProceduralParametersRead.vector3Value(shape.high),
    };
  }

  /**
   * Names the low and high ends as points.
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
