import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PROCEDURAL_PEOPLE_MOVER_ELEVATOR_MAX_RUN,
  PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES,
  PROCEDURAL_PEOPLE_MOVER_MIN_LENGTH,
  PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES,
  ProceduralPeopleMoverShapeResolver,
} from '@/procedural/generator/people_mover/procedural_people_mover_shape.js';
import { endAtAngle } from './procedural_people_mover_test_ends.js';

const start = new THREE.Vector3(1, 2, -1);
const nudge = 0.01;

/** The angle between the ends picks the shape. */
describe('ProceduralPeopleMoverShapeResolver', () => {
  it('switches shape at each threshold', () => {
    const kindAt = (angle: number): string =>
      ProceduralPeopleMoverShapeResolver.resolve(start, endAtAngle(start, angle, 8)).kind;
    expect(kindAt(0)).toBe('travelator');
    expect(kindAt(PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES - nudge)).toBe('travelator');
    expect(kindAt(PROCEDURAL_PEOPLE_MOVER_TRAVELATOR_MAX_DEGREES + nudge)).toBe('escalator');
    expect(kindAt(PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES - nudge)).toBe('escalator');
    expect(kindAt(PROCEDURAL_PEOPLE_MOVER_ESCALATOR_MAX_DEGREES + nudge)).toBe('too_steep');
    expect(kindAt(89)).toBe('too_steep');
    expect(kindAt(90)).toBe('elevator');
  });

  it('counts ends on one plumb line within the elevator run as an elevator', () => {
    const end = start.clone().add(new THREE.Vector3(PROCEDURAL_PEOPLE_MOVER_ELEVATOR_MAX_RUN * 0.9, 6, 0));
    expect(ProceduralPeopleMoverShapeResolver.resolve(start, end).kind).toBe('elevator');
  });

  it('refuses ends that nearly meet', () => {
    const end = start.clone().add(new THREE.Vector3(PROCEDURAL_PEOPLE_MOVER_MIN_LENGTH / 2, 0, 0));
    expect(ProceduralPeopleMoverShapeResolver.resolve(start, end).kind).toBe('too_short');
  });

  it('measures from the low end to the high end whichever end is given first', () => {
    const end = endAtAngle(start, 30, 6);
    const forward = ProceduralPeopleMoverShapeResolver.resolve(start, end);
    const backward = ProceduralPeopleMoverShapeResolver.resolve(end, start);
    for (const shape of [forward, backward]) {
      expect(shape.low.equals(start)).toBe(true);
      expect(shape.high.equals(end)).toBe(true);
      expect(shape.rise).toBeCloseTo(end.y - start.y, 9);
      expect(shape.length).toBeCloseTo(6, 9);
      expect(shape.angleDegrees).toBeCloseTo(30, 9);
    }
  });
});
