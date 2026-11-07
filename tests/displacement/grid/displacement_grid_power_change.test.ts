import { describe, expect, it } from 'vitest';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import {
  displacementRowLength,
  displacementSurfaceCreate,
  displacementVertexCount,
} from '@/displacement/model/displacement_face_surface.js';
import { displacementPowerChange } from '@/displacement/grid/displacement_grid_power_change.js';
import { displacementSeamOffsetsComponentsSplit } from '@/displacement/model/displacement_seam_offsets.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';

/**
 * Reads the value at a fractional grid position given as a share of the side.
 *
 * @param values Row-major values.
 * @param rowLength Vertices per side.
 * @param rowShare Row position from 0 to 1.
 * @param columnShare Column position from 0 to 1.
 * @returns Value of the vertex at that position.
 */
function powerTestValueAt(values: readonly number[], rowLength: number, rowShare: number, columnShare: number): number {
  const steps = rowLength - 1;
  return values[Math.round(rowShare * steps) * rowLength + Math.round(columnShare * steps)] ?? Number.NaN;
}

/** Changing the subdivision power of a displacement. */
describe('displacementPowerChange', () => {
  it('raises and lowers the power, keeping values at shared grid points, elevation, scale and flags', () => {
    const source = displacementSurfaceCreate(3, 0.3);
    DisplacementSculptOps.applyNoise(source, -1, 1, 9);
    source.alphas = source.alphas.map((_alpha, index) => (index * 37) % 256);
    source.scale = 1.25;
    source.flags.seals = true;
    DISPLACEMENT_POWERS.forEach((power) => {
      const changed = displacementPowerChange(source, power);
      const rowLength = displacementRowLength(power);
      expect(changed.power).toBe(power);
      expect(changed.offsets).toHaveLength(displacementVertexCount(power));
      expect(changed.alphas).toHaveLength(displacementVertexCount(power));
      expect(changed).toMatchObject({ elevation: source.elevation, scale: source.scale, flags: source.flags });
      const coarserSide = Math.min(rowLength, displacementRowLength(source.power)) - 1;
      for (let step = 0; step <= coarserSide; step++) {
        const share = step / coarserSide;
        const sourceRowLength = displacementRowLength(source.power);
        expect(powerTestValueAt(changed.offsets, rowLength, share, share)).toBeCloseTo(
          powerTestValueAt(source.offsets, sourceRowLength, share, share),
          9,
        );
      }
    });
  });

  it('returns an independent copy and leaves the source unchanged', () => {
    const source = displacementSurfaceCreate(2);
    const same = displacementPowerChange(source, 2);
    same.offsets[0] = 5;
    same.flags.noRayCollision = true;
    expect(source.offsets[0]).toBe(0);
    expect(source.flags.noRayCollision).toBe(false);
    displacementPowerChange(source, 4);
    expect(source.power).toBe(2);
  });

  it('resamples every seam offset component like the offsets and keeps absent seam offsets absent', () => {
    const source = displacementSurfaceCreate(3);
    source.seamOffsets = Array.from({ length: source.offsets.length * 3 }, (_unused, index) => Math.sin(index * 0.7));
    const sourceComponents = displacementSeamOffsetsComponentsSplit(source.seamOffsets);
    const sourceRowLength = displacementRowLength(source.power);
    DISPLACEMENT_POWERS.forEach((power) => {
      const changed = displacementPowerChange(source, power);
      const rowLength = displacementRowLength(power);
      expect(changed.seamOffsets).toHaveLength(displacementVertexCount(power) * 3);
      const changedComponents = displacementSeamOffsetsComponentsSplit(changed.seamOffsets ?? []);
      const coarserSide = Math.min(rowLength, sourceRowLength) - 1;
      sourceComponents.forEach((component, axis) => {
        for (let step = 0; step <= coarserSide; step++) {
          const share = step / coarserSide;
          expect(powerTestValueAt(changedComponents[axis] ?? [], rowLength, share, 1 - share)).toBeCloseTo(
            powerTestValueAt(component, sourceRowLength, share, 1 - share),
            9,
          );
        }
      });
    });
    const plain = displacementPowerChange(displacementSurfaceCreate(2), 4);
    expect('seamOffsets' in plain).toBe(false);
  });
});
