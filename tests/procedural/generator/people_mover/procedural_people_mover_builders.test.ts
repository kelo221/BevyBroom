import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProceduralPeopleMoverBuilderElevator } from '@/procedural/generator/people_mover/procedural_people_mover_builder_elevator.js';
import { ProceduralPeopleMoverBuilderIncline } from '@/procedural/generator/people_mover/procedural_people_mover_builder_incline.js';
import {
  PROCEDURAL_PEOPLE_MOVER_PART_CAR,
  PROCEDURAL_PEOPLE_MOVER_SIZES,
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
});
