import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { PROCEDURAL_PART_ROLE_GLASS, proceduralPartRoleOf } from '@/procedural/build/procedural_part_role.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import {
  PROCEDURAL_GENERATOR_WINDOW_ID,
  PROCEDURAL_WINDOW_COLUMNS,
  PROCEDURAL_WINDOW_CORNER_A,
  PROCEDURAL_WINDOW_CORNER_B,
  PROCEDURAL_WINDOW_FRAME_WIDTH,
  PROCEDURAL_WINDOW_MULLION_WIDTH,
  PROCEDURAL_WINDOW_ROWS,
  ProceduralGeneratorWindow,
} from '@/procedural/generator/window/procedural_generator_window.js';
import {
  PROCEDURAL_WINDOW_GLASS_THICKNESS,
  PROCEDURAL_WINDOW_SLOT_FRAME,
  PROCEDURAL_WINDOW_SLOT_GLASS,
} from '@/procedural/generator/window/procedural_window_builder.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import { proceduralPartBoundsOf, proceduralPartConvexIs } from '../../procedural_part_test_checks.js';

const generator = new ProceduralGeneratorWindow();
const CORNER_A = new THREE.Vector3(1, 2, 3);

/**
 * Returns window parameters with a box from a fixed corner.
 *
 * @param size Size of the box from corner A.
 * @param overrides Other parameter values to set.
 * @returns Sanitized parameters.
 */
function windowParameters(size: THREE.Vector3, overrides: Record<string, unknown> = {}): ProceduralParameters {
  return generator.parametersSanitize({
    [PROCEDURAL_WINDOW_CORNER_A]: CORNER_A.toArray(),
    [PROCEDURAL_WINDOW_CORNER_B]: CORNER_A.clone().add(size).toArray(),
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
 * Returns the size of the box around a part.
 *
 * @param part Built part.
 * @returns Size on each axis.
 */
function sizeOf(part: ProceduralPart): THREE.Vector3 {
  return proceduralPartBoundsOf(part).getSize(new THREE.Vector3());
}

/** The window keeps frame and mullion widths and resizes its panes. */
describe('ProceduralGeneratorWindow', () => {
  it('is registered and offers the six faces of its box as handles', () => {
    expect(ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_WINDOW_ID)).toBeInstanceOf(ProceduralGeneratorWindow);
    const faces = generator.handleFaces().map((face) => `${face.side}_${face.axis}`);
    expect(new Set(faces).size).toBe(6);
    expect(generator.handlePointPaths()).toEqual([]);
  });

  it('has frame and glass slots, glass panes carry the glass role', () => {
    expect(generator.materialSlots().map((slot) => slot.name)).toEqual([
      PROCEDURAL_WINDOW_SLOT_FRAME,
      PROCEDURAL_WINDOW_SLOT_GLASS,
    ]);
    const parts = generator.partsBuild(generator.parametersCreateDefault());
    const glass = partsOfSlot(parts, PROCEDURAL_WINDOW_SLOT_GLASS);
    expect(glass.length).toBeGreaterThan(0);
    glass.forEach((part) => expect(proceduralPartRoleOf(part)).toBe(PROCEDURAL_PART_ROLE_GLASS));
    partsOfSlot(parts, PROCEDURAL_WINDOW_SLOT_FRAME).forEach((part) =>
      expect(proceduralPartRoleOf(part)).not.toBe(PROCEDURAL_PART_ROLE_GLASS),
    );
  });

  it('builds only convex parts for several pane layouts', () => {
    for (const [columns, rows] of [
      [1, 1],
      [2, 2],
      [3, 1],
      [4, 3],
    ]) {
      const parameters = windowParameters(new THREE.Vector3(2, 1.5, 0.125), {
        [PROCEDURAL_WINDOW_COLUMNS]: columns,
        [PROCEDURAL_WINDOW_ROWS]: rows,
      });
      const parts = generator.partsBuild(parameters);
      expect(parts.length).toBeGreaterThan(0);
      parts.forEach((part) => expect(proceduralPartConvexIs(part)).toBe(true));
    }
  });

  it('starts as one pane without mullions, and columns or rows add only their own mullions', () => {
    const isMullion = (part: ProceduralPart): boolean => part.name.startsWith('Mullion');
    const plain = generator.partsBuild(generator.parametersCreateDefault());
    expect(plain.filter(isMullion)).toEqual([]);
    expect(partsOfSlot(plain, PROCEDURAL_WINDOW_SLOT_GLASS)).toHaveLength(1);
    const size = new THREE.Vector3(2, 1.5, 0.125);
    const uprightsOnly = generator.partsBuild(windowParameters(size, { [PROCEDURAL_WINDOW_COLUMNS]: 3 }));
    expect(uprightsOnly.filter(isMullion).every((part) => part.name.startsWith('Mullion Column'))).toBe(true);
    expect(uprightsOnly.filter(isMullion)).toHaveLength(2);
    const crossingOnly = generator.partsBuild(windowParameters(size, { [PROCEDURAL_WINDOW_ROWS]: 2 }));
    expect(crossingOnly.filter(isMullion).every((part) => part.name.startsWith('Mullion Row'))).toBe(true);
    expect(crossingOnly.filter(isMullion)).toHaveLength(1);
  });

  it('marks only its glass slot as glass', () => {
    const glassSlots = generator.materialSlots().filter((slot) => slot.isGlass === true);
    expect(glassSlots.map((slot) => slot.name)).toEqual([PROCEDURAL_WINDOW_SLOT_GLASS]);
  });

  it('builds a pane per cell', () => {
    const parameters = windowParameters(new THREE.Vector3(2, 1.5, 0.125), {
      [PROCEDURAL_WINDOW_COLUMNS]: 3,
      [PROCEDURAL_WINDOW_ROWS]: 4,
    });
    expect(partsOfSlot(generator.partsBuild(parameters), PROCEDURAL_WINDOW_SLOT_GLASS)).toHaveLength(12);
  });

  it('spans exactly the box between the corners', () => {
    const size = new THREE.Vector3(2.5, 1.75, 0.25);
    const bounds = new THREE.Box3();
    generator.partsBuild(windowParameters(size)).forEach((part) => bounds.union(proceduralPartBoundsOf(part)));
    expect(bounds.min.toArray()).toEqual(CORNER_A.toArray());
    expect(bounds.max.toArray()).toEqual(CORNER_A.clone().add(size).toArray());
  });

  it('keeps frame and mullion widths when the window is resized', () => {
    const frameWidth = 0.125;
    const mullionWidth = 0.0625;
    const overrides = {
      [PROCEDURAL_WINDOW_FRAME_WIDTH]: frameWidth,
      [PROCEDURAL_WINDOW_MULLION_WIDTH]: mullionWidth,
      [PROCEDURAL_WINDOW_COLUMNS]: 3,
      [PROCEDURAL_WINDOW_ROWS]: 2,
    };
    for (const size of [new THREE.Vector3(1.5, 1, 0.125), new THREE.Vector3(4.25, 3.5, 0.125)]) {
      const parts = generator.partsBuild(windowParameters(size, overrides));
      const bySuffix = (prefix: string): ProceduralPart[] => parts.filter((part) => part.name.startsWith(prefix));
      bySuffix('Frame Bottom')
        .concat(bySuffix('Frame Top'))
        .forEach((part) => expect(sizeOf(part).y).toBeCloseTo(frameWidth, 9));
      bySuffix('Frame Left')
        .concat(bySuffix('Frame Right'))
        .forEach((part) => expect(sizeOf(part).x).toBeCloseTo(frameWidth, 9));
      bySuffix('Mullion Column').forEach((part) => expect(sizeOf(part).x).toBeCloseTo(mullionWidth, 9));
      bySuffix('Mullion Row').forEach((part) => expect(sizeOf(part).y).toBeCloseTo(mullionWidth, 9));
    }
  });

  it('keeps the part count and grows only the panes when the window grows', () => {
    const small = generator.partsBuild(windowParameters(new THREE.Vector3(1.5, 1.25, 0.125)));
    const large = generator.partsBuild(windowParameters(new THREE.Vector3(3.5, 2.75, 0.125)));
    expect(large).toHaveLength(small.length);
    const smallPane = sizeOf(partsOfSlot(small, PROCEDURAL_WINDOW_SLOT_GLASS)[0] as ProceduralPart);
    const largePane = sizeOf(partsOfSlot(large, PROCEDURAL_WINDOW_SLOT_GLASS)[0] as ProceduralPart);
    expect(largePane.x).toBeGreaterThan(smallPane.x);
    expect(largePane.y).toBeGreaterThan(smallPane.y);
    expect(largePane.z).toBeCloseTo(smallPane.z, 9);
  });

  it('makes the panes of one axis even to within one grid step', () => {
    const parameters = windowParameters(new THREE.Vector3(3.5, 1.25, 0.125), { [PROCEDURAL_WINDOW_COLUMNS]: 4 });
    const widths = partsOfSlot(generator.partsBuild(parameters), PROCEDURAL_WINDOW_SLOT_GLASS)
      .filter((pane) => pane.name.startsWith('Glass 1 '))
      .map((pane) => sizeOf(pane).x);
    expect(widths).toHaveLength(4);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2 * GRID_INTERVAL_MINIMUM + 1e-9);
  });

  it('makes the glass thin and centered in the depth', () => {
    const depth = 0.375;
    const parts = generator.partsBuild(windowParameters(new THREE.Vector3(2, 1.5, depth)));
    for (const pane of partsOfSlot(parts, PROCEDURAL_WINDOW_SLOT_GLASS)) {
      const bounds = proceduralPartBoundsOf(pane);
      expect(sizeOf(pane).z).toBeCloseTo(PROCEDURAL_WINDOW_GLASS_THICKNESS, 9);
      expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(CORNER_A.z + depth / 2, 9);
    }
  });

  it('accepts corners in either order', () => {
    const size = new THREE.Vector3(2, 1.5, 0.125);
    const forward = generator.partsBuild(windowParameters(size));
    const swapped = generator.partsBuild(
      generator.parametersSanitize({
        [PROCEDURAL_WINDOW_CORNER_A]: CORNER_A.clone().add(size).toArray(),
        [PROCEDURAL_WINDOW_CORNER_B]: CORNER_A.toArray(),
      }),
    );
    expect(swapped).toEqual(forward);
  });

  it('is deterministic', () => {
    const parameters = windowParameters(new THREE.Vector3(2.25, 1.5, 0.125));
    expect(generator.partsBuild(parameters)).toEqual(generator.partsBuild(parameters));
  });

  it('refuses a window too small for its frame and says so', () => {
    const parameters = windowParameters(new THREE.Vector3(0.125, 1, 0.125), {
      [PROCEDURAL_WINDOW_FRAME_WIDTH]: 0.0625,
    });
    expect(generator.issuesDescribe(parameters).join(' ')).toMatch(/too small for its frame/);
    expect(generator.partsBuild(parameters)).toEqual([]);
  });

  it('refuses a window too small for its columns of panes', () => {
    const parameters = windowParameters(new THREE.Vector3(0.5, 1, 0.125), {
      [PROCEDURAL_WINDOW_COLUMNS]: 12,
      [PROCEDURAL_WINDOW_MULLION_WIDTH]: 0.0625,
    });
    expect(generator.issuesDescribe(parameters).join(' ')).toMatch(/columns and rows/);
    expect(generator.partsBuild(parameters)).toEqual([]);
  });

  it('keeps a volume when both corners are equal', () => {
    const parameters = generator.parametersSanitize({
      [PROCEDURAL_WINDOW_CORNER_A]: CORNER_A.toArray(),
      [PROCEDURAL_WINDOW_CORNER_B]: CORNER_A.toArray(),
    });
    const a = new THREE.Vector3(...(parameters[PROCEDURAL_WINDOW_CORNER_A] as number[]));
    const b = new THREE.Vector3(...(parameters[PROCEDURAL_WINDOW_CORNER_B] as number[]));
    const size = b.sub(a);
    expect(Math.min(size.x, size.y, size.z)).toBeGreaterThan(0);
  });

  it('has no issues for the defaults', () => {
    expect(generator.issuesDescribe(generator.parametersCreateDefault())).toEqual([]);
  });
});
