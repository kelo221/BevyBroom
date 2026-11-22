import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import {
  PROCEDURAL_GENERATOR_RAILING_ID,
  PROCEDURAL_RAILING_END,
  PROCEDURAL_RAILING_END_POSTS,
  PROCEDURAL_RAILING_HEIGHT,
  PROCEDURAL_RAILING_MAX_POST_SPACING,
  PROCEDURAL_RAILING_MID_RAIL_COUNT,
  PROCEDURAL_RAILING_POST_SIZE,
  PROCEDURAL_RAILING_RAIL_SIZE,
  PROCEDURAL_RAILING_START,
  ProceduralGeneratorRailing,
} from '@/procedural/generator/railing/procedural_generator_railing.js';
import {
  PROCEDURAL_RAILING_SLOT_POSTS,
  PROCEDURAL_RAILING_SLOT_RAILS,
} from '@/procedural/generator/railing/procedural_railing_builder.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { proceduralPartBoundsOf, proceduralPartConvexIs } from '../../procedural_part_test_checks.js';

const generator = new ProceduralGeneratorRailing();
const START = new THREE.Vector3(-2, 1, 4);

/**
 * Returns railing parameters starting at a fixed point.
 *
 * @param runEnd Offset of the second end from the start.
 * @param overrides Other parameter values to set.
 * @returns Sanitized parameters.
 */
function railingParameters(runEnd: THREE.Vector3, overrides: Record<string, unknown> = {}): ProceduralParameters {
  return generator.parametersSanitize({
    [PROCEDURAL_RAILING_START]: START.toArray(),
    [PROCEDURAL_RAILING_END]: START.clone().add(runEnd).toArray(),
    ...overrides,
  });
}

/**
 * Returns the parts that use a material slot.
 *
 * @param parts Built parts.
 * @param slot Slot name.
 * @returns Parts of the slot in build order.
 */
function partsOfSlot(parts: readonly ProceduralPart[], slot: string): ProceduralPart[] {
  return parts.filter((part) => part.materialSlot === slot);
}

/**
 * Returns the sizes of the posts.
 *
 * @param parts Built parts.
 * @returns Size of every post in build order.
 */
function postSizesOf(parts: readonly ProceduralPart[]): THREE.Vector3[] {
  return partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_POSTS).map((post) =>
    proceduralPartBoundsOf(post).getSize(new THREE.Vector3()),
  );
}

/**
 * Returns the distances between the centers of neighbouring posts of a railing
 * along X.
 *
 * @param parts Built parts of a railing along X.
 * @returns Center distance of each post to the next.
 */
function postSpacingsOf(parts: readonly ProceduralPart[]): number[] {
  const centers = partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_POSTS).map(
    (post) => proceduralPartBoundsOf(post).getCenter(new THREE.Vector3()).x,
  );
  return centers.slice(1).map((center, index) => center - (centers[index] ?? 0));
}

/** The railing re-spaces its posts and stretches its rails. */
describe('ProceduralGeneratorRailing', () => {
  it('is registered and offers both ends as handles', () => {
    expect(ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_RAILING_ID)).toBeInstanceOf(
      ProceduralGeneratorRailing,
    );
    expect(generator.handlePointPaths()).toEqual([PROCEDURAL_RAILING_START, PROCEDURAL_RAILING_END]);
  });

  it('has post and rail slots and uses both', () => {
    expect(generator.materialSlots().map((slot) => slot.name)).toEqual([
      PROCEDURAL_RAILING_SLOT_POSTS,
      PROCEDURAL_RAILING_SLOT_RAILS,
    ]);
    const parts = generator.partsBuild(generator.parametersCreateDefault());
    expect(partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_POSTS).length).toBeGreaterThan(0);
    expect(partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_RAILS).length).toBeGreaterThan(0);
  });

  it('builds only convex parts, level and sloped', () => {
    for (const runEnd of [new THREE.Vector3(5, 0, 0), new THREE.Vector3(3, 2, -4)]) {
      const parts = generator.partsBuild(railingParameters(runEnd));
      expect(parts.length).toBeGreaterThan(0);
      parts.forEach((part) => expect(proceduralPartConvexIs(part)).toBe(true));
    }
  });

  it('spans the run and the height, with the end posts flush to the ends', () => {
    const length = 6;
    const parameters = railingParameters(new THREE.Vector3(length, 0, 0));
    const parts = generator.partsBuild(parameters);
    const bounds = new THREE.Box3();
    parts.forEach((part) => bounds.union(proceduralPartBoundsOf(part)));
    expect(bounds.min.x).toBeCloseTo(START.x, 9);
    expect(bounds.max.x).toBeCloseTo(START.x + length, 9);
    expect(bounds.min.y).toBeCloseTo(START.y, 9);
    expect(bounds.max.y).toBeCloseTo(START.y + Number(parameters[PROCEDURAL_RAILING_HEIGHT]), 9);
  });

  it('adds posts for a longer run without ever exceeding the maximum spacing', () => {
    const spacingLimit = 1.25;
    const overrides = { [PROCEDURAL_RAILING_MAX_POST_SPACING]: spacingLimit };
    let previousCount = 0;
    for (const length of [1, 2.5, 4, 7.75, 12]) {
      const parts = generator.partsBuild(railingParameters(new THREE.Vector3(length, 0, 0), overrides));
      const count = partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_POSTS).length;
      expect(count).toBeGreaterThanOrEqual(previousCount);
      previousCount = count;
      postSpacingsOf(parts).forEach((spacing) => expect(spacing).toBeLessThanOrEqual(spacingLimit + 1e-9));
    }
    expect(previousCount).toBeGreaterThan(5);
  });

  it('keeps post and rail sizes when only the length changes', () => {
    const short = generator.partsBuild(railingParameters(new THREE.Vector3(2, 0, 0)));
    const long = generator.partsBuild(railingParameters(new THREE.Vector3(11, 0, 0)));
    const shortPostSize = postSizesOf(short)[0];
    postSizesOf(long).forEach((size) => expect(size).toEqual(shortPostSize));
    const shortRails = partsOfSlot(short, PROCEDURAL_RAILING_SLOT_RAILS);
    const longRails = partsOfSlot(long, PROCEDURAL_RAILING_SLOT_RAILS);
    expect(longRails).toHaveLength(shortRails.length);
    longRails.forEach((rail, index) => {
      const shortSize = proceduralPartBoundsOf(shortRails[index] as ProceduralPart).getSize(new THREE.Vector3());
      const longSize = proceduralPartBoundsOf(rail).getSize(new THREE.Vector3());
      expect(longSize.y).toBeCloseTo(shortSize.y, 9);
      expect(longSize.z).toBeCloseTo(shortSize.z, 9);
      expect(longSize.x).toBeGreaterThan(shortSize.x);
    });
  });

  it('builds a top rail plus the chosen number of mid rails', () => {
    for (const midRails of [0, 1, 3]) {
      const parameters = railingParameters(new THREE.Vector3(4, 0, 0), {
        [PROCEDURAL_RAILING_MID_RAIL_COUNT]: midRails,
      });
      const rails = partsOfSlot(generator.partsBuild(parameters), PROCEDURAL_RAILING_SLOT_RAILS);
      expect(rails).toHaveLength(midRails + 1);
    }
  });

  it('keeps every rail below the top rail and the top rail flush with the posts', () => {
    const parameters = railingParameters(new THREE.Vector3(4, 0, 0), { [PROCEDURAL_RAILING_MID_RAIL_COUNT]: 3 });
    const rails = partsOfSlot(generator.partsBuild(parameters), PROCEDURAL_RAILING_SLOT_RAILS);
    const [top, ...mids] = rails.map((rail) => proceduralPartBoundsOf(rail));
    expect(top?.max.y).toBeCloseTo(START.y + Number(parameters[PROCEDURAL_RAILING_HEIGHT]), 9);
    mids.forEach((mid) => expect(mid.max.y).toBeLessThanOrEqual((top?.min.y ?? 0) + 1e-9));
  });

  it('makes the rails follow the slope while the posts stay vertical', () => {
    const rise = 3;
    const parts = generator.partsBuild(railingParameters(new THREE.Vector3(6, rise, 0)));
    const topRail = proceduralPartBoundsOf(partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_RAILS)[0] as ProceduralPart);
    const railSize = Number(railingParameters(new THREE.Vector3(6, rise, 0))[PROCEDURAL_RAILING_RAIL_SIZE]);
    expect(topRail.getSize(new THREE.Vector3()).y).toBeCloseTo(rise + railSize, 9);
    partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_POSTS).forEach((post) => {
      const size = proceduralPartBoundsOf(post).getSize(new THREE.Vector3());
      expect(size.y).toBeCloseTo(
        Number(railingParameters(new THREE.Vector3(6, rise, 0))[PROCEDURAL_RAILING_HEIGHT]),
        9,
      );
    });
  });

  it('leaves out the two end posts when they are switched off', () => {
    const withEnds = generator.partsBuild(railingParameters(new THREE.Vector3(6, 0, 0)));
    const withoutEnds = generator.partsBuild(
      railingParameters(new THREE.Vector3(6, 0, 0), { [PROCEDURAL_RAILING_END_POSTS]: false }),
    );
    expect(partsOfSlot(withoutEnds, PROCEDURAL_RAILING_SLOT_POSTS)).toHaveLength(
      partsOfSlot(withEnds, PROCEDURAL_RAILING_SLOT_POSTS).length - 2,
    );
  });

  it('puts every post on the finest grid for a level run on the grid', () => {
    const parts = generator.partsBuild(railingParameters(new THREE.Vector3(7.25, 0, 0)));
    for (const corner of partsOfSlot(parts, PROCEDURAL_RAILING_SLOT_POSTS).flatMap((post) => post.faces.flat())) {
      for (const value of [corner.x, corner.y, corner.z]) {
        expect(value * 32).toBeCloseTo(Math.round(value * 32), 9);
      }
    }
  });

  it('is deterministic', () => {
    const parameters = railingParameters(new THREE.Vector3(5.5, 1, 2));
    expect(generator.partsBuild(parameters)).toEqual(generator.partsBuild(parameters));
  });

  it('refuses a railing shorter than a post or than its shortest run', () => {
    const parameters = railingParameters(new THREE.Vector3(0.0625, 0, 0), { [PROCEDURAL_RAILING_POST_SIZE]: 0.25 });
    expect(generator.issuesDescribe(parameters).join(' ')).toMatch(/shorter than a post/);
    expect(generator.partsBuild(parameters)).toEqual([]);
    const plumb = railingParameters(new THREE.Vector3(0, 3, 0));
    expect(generator.issuesDescribe(plumb).join(' ')).toMatch(/closer than/);
  });

  it('refuses post spacing not larger than a post and rails that do not fit the height', () => {
    const tightSpacing = railingParameters(new THREE.Vector3(4, 0, 0), {
      [PROCEDURAL_RAILING_POST_SIZE]: 0.5,
      [PROCEDURAL_RAILING_MAX_POST_SPACING]: 0.25,
    });
    expect(generator.issuesDescribe(tightSpacing).join(' ')).toMatch(/spacing/);
    const crowdedRails = railingParameters(new THREE.Vector3(4, 0, 0), {
      [PROCEDURAL_RAILING_HEIGHT]: 0.25,
      [PROCEDURAL_RAILING_MID_RAIL_COUNT]: 8,
      [PROCEDURAL_RAILING_RAIL_SIZE]: 0.0625,
    });
    expect(generator.issuesDescribe(crowdedRails).join(' ')).toMatch(/rails do not fit/);
    expect(generator.partsBuild(crowdedRails)).toEqual([]);
  });

  it('has no issues for the defaults', () => {
    expect(generator.issuesDescribe(generator.parametersCreateDefault())).toEqual([]);
  });
});
