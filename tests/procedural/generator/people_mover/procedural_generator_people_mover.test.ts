import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PROCEDURAL_PEOPLE_MOVER_BELT,
  PROCEDURAL_PEOPLE_MOVER_END,
  PROCEDURAL_PEOPLE_MOVER_START,
  PROCEDURAL_PEOPLE_MOVER_WIDTH,
  ProceduralGeneratorPeopleMover,
} from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
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
    [PROCEDURAL_PEOPLE_MOVER_BELT]: 0.75,
  });
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
});
