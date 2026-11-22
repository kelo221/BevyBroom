import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import {
  PROCEDURAL_GENERATOR_GIRDER_ID,
  PROCEDURAL_GIRDER_END,
  PROCEDURAL_GIRDER_FLANGE_THICKNESS,
  PROCEDURAL_GIRDER_FLANGE_WIDTH,
  PROCEDURAL_GIRDER_HEIGHT,
  PROCEDURAL_GIRDER_PROFILE,
  PROCEDURAL_GIRDER_SLOT_STEEL,
  PROCEDURAL_GIRDER_START,
  PROCEDURAL_GIRDER_WEB_THICKNESS,
  ProceduralGeneratorGirder,
} from '@/procedural/generator/girder/procedural_generator_girder.js';
import { PROCEDURAL_GIRDER_PROFILES } from '@/procedural/generator/girder/procedural_girder_profile.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import { proceduralPartBoundsOf, proceduralPartConvexIs } from '../../procedural_part_test_checks.js';

const generator = new ProceduralGeneratorGirder();
const START = new THREE.Vector3(1, 2, -3);

/**
 * Returns girder parameters starting at a fixed point.
 *
 * @param end Second end.
 * @param overrides Other parameter values to set.
 * @returns Sanitized parameters.
 */
function girderParameters(end: THREE.Vector3, overrides: Record<string, unknown> = {}): ProceduralParameters {
  return generator.parametersSanitize({
    [PROCEDURAL_GIRDER_START]: START.toArray(),
    [PROCEDURAL_GIRDER_END]: end.toArray(),
    ...overrides,
  });
}

/**
 * Returns the box around several parts.
 *
 * @param parts Parts to enclose.
 * @returns Union of the part bounds.
 */
function partsBoundsOf(parts: readonly ProceduralPart[]): THREE.Box3 {
  const bounds = new THREE.Box3();
  parts.forEach((part) => bounds.union(proceduralPartBoundsOf(part)));
  return bounds;
}

/**
 * Returns the size of every part on the axes that do not run along the girder.
 *
 * @param parts Parts of a level girder along X.
 * @returns Height and depth of each part, in part order.
 */
function crossSectionSizesOf(parts: readonly ProceduralPart[]): number[][] {
  return parts.map((part) => {
    const size = proceduralPartBoundsOf(part).getSize(new THREE.Vector3());
    return [size.y, size.z];
  });
}

/** The girder keeps its profile and stretches along the run. */
describe('ProceduralGeneratorGirder', () => {
  it('is registered and offers both ends as handles', () => {
    expect(ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_GIRDER_ID)).toBeInstanceOf(ProceduralGeneratorGirder);
    expect(generator.handlePointPaths()).toEqual([PROCEDURAL_GIRDER_START, PROCEDURAL_GIRDER_END]);
    const paths = generator.fields().map((field) => field.path);
    generator.handlePointPaths().forEach((path) => expect(paths).toContain(path));
  });

  it('has one steel slot and every part uses it', () => {
    expect(generator.materialSlots().map((slot) => slot.name)).toEqual([PROCEDURAL_GIRDER_SLOT_STEEL]);
    const parts = generator.partsBuild(generator.parametersCreateDefault());
    expect(parts.length).toBeGreaterThan(0);
    parts.forEach((part) => expect(part.materialSlot).toBe(PROCEDURAL_GIRDER_SLOT_STEEL));
  });

  it('builds only convex parts for every profile, level and sloped', () => {
    for (const profile of PROCEDURAL_GIRDER_PROFILES) {
      for (const end of [new THREE.Vector3(5, 2, -3), new THREE.Vector3(4, 4.5, 1)]) {
        const parts = generator.partsBuild(girderParameters(end, { [PROCEDURAL_GIRDER_PROFILE]: profile }));
        expect(parts.length).toBeGreaterThan(0);
        parts.forEach((part) => expect(proceduralPartConvexIs(part)).toBe(true));
      }
    }
  });

  it('spans the handles and the profile measures for every profile', () => {
    const length = 6;
    const parameters = girderParameters(START.clone().add(new THREE.Vector3(length, 0, 0)));
    const height = Number(parameters[PROCEDURAL_GIRDER_HEIGHT]);
    const flangeWidth = Number(parameters[PROCEDURAL_GIRDER_FLANGE_WIDTH]);
    for (const profile of PROCEDURAL_GIRDER_PROFILES) {
      const bounds = partsBoundsOf(generator.partsBuild({ ...parameters, [PROCEDURAL_GIRDER_PROFILE]: profile }));
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(length, 9);
      expect(size.y).toBeCloseTo(height, 9);
      expect(size.z).toBeCloseTo(flangeWidth, 9);
      expect(bounds.min.x).toBeCloseTo(START.x, 9);
      expect(bounds.min.y).toBeCloseTo(START.y, 9);
    }
  });

  it('follows the run in any horizontal direction', () => {
    const length = 5;
    const parts = generator.partsBuild(girderParameters(START.clone().add(new THREE.Vector3(0, 0, -length))));
    const size = partsBoundsOf(parts).getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(length, 9);
    expect(size.x).toBeCloseTo(Number(girderParameters(START)[PROCEDURAL_GIRDER_FLANGE_WIDTH]), 9);
  });

  it('rises with a sloped run by the height difference of the ends', () => {
    const rise = 2.5;
    const level = partsBoundsOf(generator.partsBuild(girderParameters(START.clone().add(new THREE.Vector3(4, 0, 0)))));
    const sloped = partsBoundsOf(
      generator.partsBuild(girderParameters(START.clone().add(new THREE.Vector3(4, rise, 0)))),
    );
    expect(sloped.getSize(new THREE.Vector3()).y).toBeCloseTo(level.getSize(new THREE.Vector3()).y + rise, 9);
  });

  it('keeps every piece size when only the length changes', () => {
    for (const profile of PROCEDURAL_GIRDER_PROFILES) {
      const overrides = { [PROCEDURAL_GIRDER_PROFILE]: profile };
      const short = generator.partsBuild(girderParameters(START.clone().add(new THREE.Vector3(2, 0, 0)), overrides));
      const long = generator.partsBuild(girderParameters(START.clone().add(new THREE.Vector3(9.5, 0, 0)), overrides));
      expect(long).toHaveLength(short.length);
      expect(crossSectionSizesOf(long)).toEqual(crossSectionSizesOf(short));
      expect(partsBoundsOf(long).getSize(new THREE.Vector3()).x).toBeGreaterThan(
        partsBoundsOf(short).getSize(new THREE.Vector3()).x,
      );
    }
  });

  it('puts every corner on the finest grid when the ends and measures are on it', () => {
    const end = new THREE.Vector3(5.25, 2, -3);
    const parts = generator.partsBuild(girderParameters(end, { [PROCEDURAL_GIRDER_WEB_THICKNESS]: 0.0625 }));
    for (const corner of parts.flatMap((part) => part.faces.flat())) {
      for (const value of [corner.x, corner.y, corner.z]) {
        const steps = value / GRID_INTERVAL_MINIMUM;
        expect(steps).toBeCloseTo(Math.round(steps), 9);
      }
    }
  });

  it('is deterministic', () => {
    const parameters = girderParameters(new THREE.Vector3(7, 3, 2));
    expect(generator.partsBuild(parameters)).toEqual(generator.partsBuild(parameters));
  });

  it('refuses ends on one plumb line and says so', () => {
    const parameters = girderParameters(START.clone().add(new THREE.Vector3(0, 3, 0)));
    expect(generator.issuesDescribe(parameters).join(' ')).toMatch(/closer than/);
    expect(generator.partsBuild(parameters)).toEqual([]);
  });

  it('refuses flanges as thick as the girder is high and webs as thick as it is wide', () => {
    const thickFlanges = girderParameters(START.clone().add(new THREE.Vector3(4, 0, 0)), {
      [PROCEDURAL_GIRDER_HEIGHT]: 0.125,
      [PROCEDURAL_GIRDER_FLANGE_THICKNESS]: 0.0625,
    });
    expect(generator.issuesDescribe(thickFlanges).join(' ')).toMatch(/flanges/);
    expect(generator.partsBuild(thickFlanges)).toEqual([]);
    const thickWeb = girderParameters(START.clone().add(new THREE.Vector3(4, 0, 0)), {
      [PROCEDURAL_GIRDER_FLANGE_WIDTH]: 0.0625,
      [PROCEDURAL_GIRDER_WEB_THICKNESS]: 0.0625,
    });
    expect(generator.issuesDescribe(thickWeb).join(' ')).toMatch(/web/);
    expect(generator.partsBuild(thickWeb)).toEqual([]);
  });

  it('has no issues for the defaults', () => {
    expect(generator.issuesDescribe(generator.parametersCreateDefault())).toEqual([]);
  });
});
