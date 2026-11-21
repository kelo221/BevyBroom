import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProceduralPeopleMoverBuilderElevator } from '@/procedural/generator/people_mover/procedural_people_mover_builder_elevator.js';
import { ProceduralPeopleMoverBuilderIncline } from '@/procedural/generator/people_mover/procedural_people_mover_builder_incline.js';
import {
  PROCEDURAL_PEOPLE_MOVER_BRUSH_SIZE,
  PROCEDURAL_PEOPLE_MOVER_PART_CAR,
  PROCEDURAL_PEOPLE_MOVER_SIZES,
  PROCEDURAL_PEOPLE_MOVER_SIZES_OFF_GRID,
} from '@/procedural/generator/people_mover/procedural_people_mover_dimensions.js';
import { ProceduralPeopleMoverShapeResolver } from '@/procedural/generator/people_mover/procedural_people_mover_shape.js';
import { proceduralPartBoundsOf } from '../../procedural_part_test_checks.js';
import { endAtAngle } from './procedural_people_mover_test_ends.js';

/** The incline and elevator builders place every piece where the ends say. */
describe('people mover builders', () => {
  const start = new THREE.Vector3(-1, 0.5, 2);

  it('puts a level landing plate beyond each end of an incline, its top at that end', () => {
    for (const angle of [5, 30]) {
      const shape = ProceduralPeopleMoverShapeResolver.resolve(start, endAtAngle(start, angle, 7));
      const parts =
        shape.kind === 'escalator'
          ? ProceduralPeopleMoverBuilderIncline.escalatorBuild(shape, 1.4)
          : ProceduralPeopleMoverBuilderIncline.travelatorBuild(shape, 1.4);
      const low = parts.find((part) => part.name === 'Landing Low');
      const high = parts.find((part) => part.name === 'Landing High');
      expect(low ? proceduralPartBoundsOf(low).max.y : NaN).toBeCloseTo(shape.low.y, 9);
      expect(high ? proceduralPartBoundsOf(high).max.y : NaN).toBeCloseTo(shape.high.y, 9);
      expect(parts.filter((part) => part.name.startsWith('Panel '))).toHaveLength(2);
      expect(parts.filter((part) => part.name.startsWith('Handrail '))).toHaveLength(2);
    }
  });

  it('counts steps from the largest riser', () => {
    const riser = PROCEDURAL_PEOPLE_MOVER_SIZES.stepRiserMax;
    expect(ProceduralPeopleMoverBuilderIncline.stepCountOf(riser * 10)).toBe(10);
    expect(ProceduralPeopleMoverBuilderIncline.stepCountOf(riser * 10 + 0.01)).toBe(11);
    expect(ProceduralPeopleMoverBuilderIncline.stepCountOf(0.01)).toBe(1);
  });

  it('builds the car first with the posts outside it', () => {
    const width = 1.8;
    const shape = ProceduralPeopleMoverShapeResolver.resolve(start, start.clone().add(new THREE.Vector3(0, 6, 0)));
    const [car, ...posts] = ProceduralPeopleMoverBuilderElevator.build(shape, width);
    expect(car?.name).toBe(PROCEDURAL_PEOPLE_MOVER_PART_CAR);
    const carBounds = car ? proceduralPartBoundsOf(car) : new THREE.Box3();
    expect(carBounds.getSize(new THREE.Vector3()).x).toBeCloseTo(width, 9);
    for (const post of posts) {
      expect(proceduralPartBoundsOf(post).intersectsBox(carBounds.clone().expandByScalar(-1e-6))).toBe(false);
    }
  });

  /** Whether a length is a whole number of brush sizes. */
  const isOnBrushGrid = (length: number): boolean => {
    const brushes = length / PROCEDURAL_PEOPLE_MOVER_BRUSH_SIZE;
    return Math.abs(brushes - Math.round(brushes)) < 1e-6;
  };

  it('sizes every structural piece in whole brush sizes', () => {
    const structural = Object.entries(PROCEDURAL_PEOPLE_MOVER_SIZES).filter(
      ([name]) => !PROCEDURAL_PEOPLE_MOVER_SIZES_OFF_GRID.has(name as keyof typeof PROCEDURAL_PEOPLE_MOVER_SIZES),
    );
    expect(structural.length).toBeGreaterThan(0);
    for (const [name, size] of structural) {
      expect(isOnBrushGrid(size), `${name} is ${size} m`).toBe(true);
    }
  });

  it('puts the level pieces of a mover with ends and width on the brush grid on that grid too', () => {
    const gridStart = new THREE.Vector3(-2, 0.5, 3);
    const gridEnd = new THREE.Vector3(-2, 4.5, -9);
    const shape = ProceduralPeopleMoverShapeResolver.resolve(gridStart, gridEnd);
    const parts = ProceduralPeopleMoverBuilderIncline.travelatorBuild(shape, 2);
    const levelPieces = parts.filter((part) => part.name.startsWith('Landing'));
    expect(levelPieces).toHaveLength(2);
    for (const piece of levelPieces) {
      const bounds = proceduralPartBoundsOf(piece);
      for (const coordinate of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
        expect(isOnBrushGrid(coordinate), `${piece.name} reaches ${coordinate}`).toBe(true);
      }
    }
  });
});
