import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
  PROCEDURAL_PEOPLE_MOVER_BELT,
  PROCEDURAL_PEOPLE_MOVER_DIRECTION,
  PROCEDURAL_PEOPLE_MOVER_END,
  PROCEDURAL_PEOPLE_MOVER_SPEED,
  PROCEDURAL_PEOPLE_MOVER_START,
  PROCEDURAL_PEOPLE_MOVER_WIDTH,
  ProceduralGeneratorPeopleMover,
} from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import {
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START,
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
} from '@/procedural/generator/people_mover/procedural_people_mover_travel.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';
import {
  PROCEDURAL_PEOPLE_MOVER_PART_CAR,
  PROCEDURAL_PEOPLE_MOVER_SIZES,
} from '@/procedural/generator/people_mover/procedural_people_mover_dimensions.js';
import {
  PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES,
  PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES,
} from '@/procedural/generator/people_mover/procedural_people_mover_shape.js';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { proceduralPartBoundsOf, proceduralPartConvexIs } from '../../procedural_part_test_checks.js';
import { endAtAngle } from './procedural_people_mover_test_ends.js';

const generator = new ProceduralGeneratorPeopleMover();
const start = new THREE.Vector3(2, 1, -3);
const speed = 0.75;

/**
 * Returns mover parameters between two ends.
 *
 * @param end Second end.
 * @param width Width.
 * @returns Sanitized parameters.
 */
function moverParameters(end: THREE.Vector3, width = 1.6): ProceduralParameters {
  return generator.parametersSanitize({
    [PROCEDURAL_PEOPLE_MOVER_START]: start.toArray(),
    [PROCEDURAL_PEOPLE_MOVER_END]: end.toArray(),
    [PROCEDURAL_PEOPLE_MOVER_WIDTH]: width,
    [PROCEDURAL_PEOPLE_MOVER_SPEED]: speed,
  });
}

/**
 * Returns parameters of a mover between two ends carrying people one way.
 *
 * @param from Start end.
 * @param to End end.
 * @param direction Direction value.
 * @returns Sanitized parameters.
 */
function moverDirected(from: THREE.Vector3, to: THREE.Vector3, direction: string): ProceduralParameters {
  return generator.parametersSanitize({
    [PROCEDURAL_PEOPLE_MOVER_START]: from.toArray(),
    [PROCEDURAL_PEOPLE_MOVER_END]: to.toArray(),
    [PROCEDURAL_PEOPLE_MOVER_DIRECTION]: direction,
    [PROCEDURAL_PEOPLE_MOVER_SPEED]: speed,
  });
}

/**
 * Sanitizes people mover parameters saved by parameter layout version 1.
 *
 * @param from Start end.
 * @param to End end.
 * @param belt Signed belt speed, positive toward the high end.
 * @returns Parameters in the current layout.
 */
function moverFromVersionOne(from: THREE.Vector3, to: THREE.Vector3, belt: number): ProceduralParameters {
  return ProceduralSettingsRules.sanitize({
    generatorId: PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
    generatorVersion: 1,
    parameters: { [PROCEDURAL_PEOPLE_MOVER_START]: from.toArray(), [PROCEDURAL_PEOPLE_MOVER_END]: to.toArray(), belt },
    materials: {},
  }).parameters;
}

/**
 * Returns parameters of a mover at an angle.
 *
 * @param angleDegrees Angle above the horizontal.
 * @param length Distance between the ends.
 * @returns Sanitized parameters.
 */
function moverAt(angleDegrees: number, length = 8): ProceduralParameters {
  return moverParameters(endAtAngle(start, angleDegrees, length));
}

/** A people mover becomes a travelator, an escalator or an elevator. */
describe('ProceduralGeneratorPeopleMover', () => {
  const shapes: readonly (readonly [string, ProceduralParameters])[] = [
    ['travelator', moverAt(PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES / 2)],
    [
      'escalator',
      moverAt((PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES + PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES) / 2),
    ],
    ['elevator', moverParameters(start.clone().add(new THREE.Vector3(0, 7, 0)))],
  ];

  it('reports the shape the parameters build as a derived value', () => {
    for (const [shape, parameters] of shapes) {
      expect(generator.derivedValues(parameters)['shape']).toBe(shape);
      expect(generator.issuesDescribe(parameters)).toEqual([]);
    }
  });

  it('builds only convex parts with unique names', () => {
    for (const [, parameters] of shapes) {
      const parts = generator.partsBuild(parameters);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.every((part) => proceduralPartConvexIs(part))).toBe(true);
      expect(new Set(parts.map((part) => part.name)).size).toBe(parts.length);
    }
  });

  it('builds the same parts for the same parameters', () => {
    for (const [, parameters] of shapes) {
      expect(JSON.stringify(generator.partsBuild(parameters))).toBe(JSON.stringify(generator.partsBuild(parameters)));
    }
  });

  it('gives an escalator as many steps as its rise needs, reaching the high end', () => {
    for (const length of [3, 8, 14]) {
      const parameters = moverAt(30, length);
      const derived = generator.derivedValues(parameters);
      const steps = generator.partsBuild(parameters).filter((part) => part.name.startsWith('Step '));
      const rise = Number(derived['rise']);
      expect(steps).toHaveLength(Number(derived['step_count']));
      expect(rise / steps.length).toBeLessThanOrEqual(PROCEDURAL_PEOPLE_MOVER_SIZES.stepRiserMax + 1e-9);
      const topStep = steps.at(-1);
      expect(topStep ? proceduralPartBoundsOf(topStep).max.y : 0).toBeCloseTo(start.y + rise, 6);
    }
    expect(generator.derivedValues(moverAt(6))['step_count']).toBe(0);
  });

  it('keeps the tread as wide as the width field, measured across the run', () => {
    const width = 2.2;
    const end = endAtAngle(start, 0, 10);
    const belt = generator.partsBuild(moverParameters(end, width)).find((part) => part.name === 'Belt');
    const across = ProceduralPartFrame.acrossDirectionOf(end.clone().sub(start));
    const offsets = (belt?.faces.flat() ?? []).map((corner) => corner.clone().sub(start).dot(across));
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeCloseTo(width, 9);
  });

  it('builds an elevator as a car on the low end and a shaft reaching above the high end', () => {
    const high = start.clone().add(new THREE.Vector3(0, 7, 0));
    const parts = generator.partsBuild(moverParameters(high));
    const car = parts.find((part) => part.name === PROCEDURAL_PEOPLE_MOVER_PART_CAR);
    const shaft = parts.filter((part) => part.name.startsWith('Shaft'));
    expect(car ? proceduralPartBoundsOf(car).min.y : NaN).toBeCloseTo(start.y, 9);
    expect(shaft.length).toBe(4);
    expect(Math.min(...shaft.map((part) => proceduralPartBoundsOf(part).max.y))).toBeGreaterThan(high.y);
  });

  it('builds nothing and reports an issue between the escalator limit and vertical', () => {
    const parameters = moverAt((PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES + 90) / 2);
    expect(generator.partsBuild(parameters)).toEqual([]);
    expect(generator.issuesDescribe(parameters)).toHaveLength(1);
    expect(generator.derivedValues(parameters)['shape']).toBe('too_steep');
    const placeholder = generator.placeholderPartsBuild(parameters);
    expect(placeholder.length).toBeGreaterThan(0);
    expect(placeholder.every((part) => proceduralPartConvexIs(part))).toBe(true);
  });

  it('reports both ends low first, whichever order they are given in', () => {
    const end = endAtAngle(start, 20, 6);
    const forward = generator.derivedValues(moverParameters(end));
    const backward = generator.derivedValues(
      generator.parametersSanitize({
        [PROCEDURAL_PEOPLE_MOVER_START]: end.toArray(),
        [PROCEDURAL_PEOPLE_MOVER_END]: start.toArray(),
      }),
    );
    expect(forward['low_end']).toEqual(start.toArray());
    expect(forward['high_end']).toEqual(end.toArray());
    expect(backward['low_end']).toEqual(forward['low_end']);
  });

  it('shows the ends as point handles and the width as a span across them', () => {
    expect(generator.handlePointPaths()).toEqual([PROCEDURAL_PEOPLE_MOVER_START, PROCEDURAL_PEOPLE_MOVER_END]);
    expect(generator.handleSpans().map((span) => span.path)).toEqual([PROCEDURAL_PEOPLE_MOVER_WIDTH]);
  });

  it('carries people the chosen way: entry, exit and the belt sign toward the high end follow the direction', () => {
    const high = endAtAngle(start, 25, 6);
    for (const [from, to] of [
      [start, high],
      [high, start],
    ] as const) {
      const forward = generator.derivedValues(moverDirected(from, to, PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END));
      const reverse = generator.derivedValues(moverDirected(from, to, PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START));
      expect(forward['entry_end']).toEqual(from.toArray());
      expect(forward['exit_end']).toEqual(to.toArray());
      expect(reverse['entry_end']).toEqual(to.toArray());
      expect(reverse['exit_end']).toEqual(from.toArray());
      const forwardRisesToExit = to.y > from.y;
      expect(forward[PROCEDURAL_PEOPLE_MOVER_BELT]).toBe(forwardRisesToExit ? speed : -speed);
      expect(reverse[PROCEDURAL_PEOPLE_MOVER_BELT]).toBe(-Number(forward[PROCEDURAL_PEOPLE_MOVER_BELT]));
    }
    expect(generator.derivedPointNames()).toEqual(expect.arrayContaining(['entry_end', 'exit_end']));
  });

  it('turns a saved signed belt speed into the direction it ran and an unsigned speed', () => {
    const high = endAtAngle(start, 25, 6);
    for (const [from, to] of [
      [start, high],
      [high, start],
    ] as const) {
      for (const belt of [speed, -speed]) {
        const parameters = moverFromVersionOne(from, to, belt);
        expect(parameters[PROCEDURAL_PEOPLE_MOVER_SPEED]).toBe(speed);
        expect(parameters).not.toHaveProperty(PROCEDURAL_PEOPLE_MOVER_BELT);
        expect(generator.derivedValues(parameters)[PROCEDURAL_PEOPLE_MOVER_BELT]).toBe(belt);
      }
    }
  });

  it('keeps current parameters as they are when sanitized again', () => {
    const parameters = moverDirected(start, endAtAngle(start, 6, 5), PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START);
    const settings = ProceduralSettingsRules.sanitize({
      generatorId: PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
      generatorVersion: generator.version,
      parameters,
      materials: {},
    });
    expect(settings.parameters).toEqual(parameters);
    expect(ProceduralSettingsRules.sanitize(settings)).toEqual(settings);
  });

  it('draws travel arrows that point from the entry to the exit, and none for a refused mover', () => {
    const end = endAtAngle(start, 6, 5);
    for (const direction of [
      PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
      PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START,
    ]) {
      const parameters = moverDirected(start, end, direction);
      const derived = generator.derivedValues(parameters);
      const entry = new THREE.Vector3(...(derived['entry_end'] as number[]));
      const exit = new THREE.Vector3(...(derived['exit_end'] as number[]));
      const forward = exit.clone().sub(entry).normalize();
      const segments = generator.guideSegmentsBuild(parameters);
      expect(segments.length).toBeGreaterThan(0);
      for (let index = 0; index < segments.length; index += 2) {
        const tail = segments[index] ?? new THREE.Vector3();
        const tip = segments[index + 1] ?? new THREE.Vector3();
        expect(tip.clone().sub(tail).dot(forward)).toBeGreaterThan(0);
      }
    }
    expect(generator.guideSegmentsBuild(moverAt((PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES + 90) / 2))).toEqual([]);
  });
});
