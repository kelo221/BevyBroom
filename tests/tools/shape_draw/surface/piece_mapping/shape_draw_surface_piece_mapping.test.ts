import { describe, expect, it } from 'vitest';
import { SHAPE_DRAW_SURFACE_PIECE_MAPPING_NONE } from '@/tools/shape_draw/surface/piece_mapping/shape_draw_surface_piece_mapping.js';
import { ShapeDrawSurfacePieceMappingIndex } from '@/tools/shape_draw/surface/piece_mapping/shape_draw_surface_piece_mapping_index.js';
import { ShapeDrawSurfacePieceMappingProportional } from '@/tools/shape_draw/surface/piece_mapping/shape_draw_surface_piece_mapping_proportional.js';
import type { ShapeDrawSurfacePieceMapping } from '@/tools/shape_draw/surface/piece_mapping/shape_draw_surface_piece_mapping.js';
import { ShapeDrawShapeStairs } from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';
import { ShapeDrawShapeCylinder } from '@/tools/shape_draw/shapes/shape_draw_shape_cylinder.js';

/**
 * Lists the old piece index chosen for every new piece.
 *
 * @param mapping Mapping under test.
 * @param pieceCount Number of new pieces.
 * @param sourceCount Number of old pieces.
 * @returns Old piece index per new piece.
 */
function mappingSourceIndexesList(
  mapping: ShapeDrawSurfacePieceMapping,
  pieceCount: number,
  sourceCount: number,
): number[] {
  return Array.from({ length: pieceCount }, (_, pieceIndex) =>
    mapping.sourceIndexResolve(pieceIndex, pieceCount, sourceCount),
  );
}

/**
 * Proves how regenerated shape pieces choose the old piece they inherit
 * surfaces from.
 */
describe('ShapeDrawSurfacePieceMapping', () => {
  const mappings: ShapeDrawSurfacePieceMapping[] = [
    new ShapeDrawSurfacePieceMappingIndex(),
    new ShapeDrawSurfacePieceMappingProportional(),
  ];

  it('maps every piece to itself when the piece count does not change', () => {
    const pieceCount = 7;
    const identity = Array.from({ length: pieceCount }, (_, pieceIndex) => pieceIndex);
    mappings.forEach((mapping) => expect(mappingSourceIndexesList(mapping, pieceCount, pieceCount)).toEqual(identity));
  });

  it('reports no source when there are no old pieces', () => {
    mappings.forEach((mapping) =>
      expect(mapping.sourceIndexResolve(0, 3, 0)).toBe(SHAPE_DRAW_SURFACE_PIECE_MAPPING_NONE),
    );
  });

  it('keeps every chosen index inside the old piece range', () => {
    const counts = [1, 2, 5, 9];
    mappings.forEach((mapping) =>
      counts.forEach((pieceCount) =>
        counts.forEach((sourceCount) =>
          mappingSourceIndexesList(mapping, pieceCount, sourceCount).forEach((sourceIndex) => {
            expect(sourceIndex).toBeGreaterThanOrEqual(0);
            expect(sourceIndex).toBeLessThan(sourceCount);
          }),
        ),
      ),
    );
  });

  it('index mapping keeps first and last pieces and gives added pieces the last old piece', () => {
    const mapping = new ShapeDrawSurfacePieceMappingIndex();
    const sourceCount = 4;
    const grown = mappingSourceIndexesList(mapping, sourceCount * 2, sourceCount);
    expect(grown.slice(0, sourceCount)).toEqual([0, 1, 2, 3]);
    expect(grown.slice(sourceCount).every((sourceIndex) => sourceIndex === sourceCount - 1)).toBe(true);
    const shrunk = mappingSourceIndexesList(mapping, 2, sourceCount);
    expect(shrunk).toEqual([0, sourceCount - 1]);
  });

  it('proportional mapping never decreases and spans the whole old order', () => {
    const mapping = new ShapeDrawSurfacePieceMappingProportional();
    const sourceCount = 6;
    const indexes = mappingSourceIndexesList(mapping, 9, sourceCount);
    indexes.slice(1).forEach((sourceIndex, order) => expect(sourceIndex).toBeGreaterThanOrEqual(indexes[order] ?? 0));
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(sourceCount - 1);
  });

  it('stairs map by step order and swept shapes map by share of the order', () => {
    expect(new ShapeDrawShapeStairs().surfacePieceMappingCreate()).toBeInstanceOf(ShapeDrawSurfacePieceMappingIndex);
    expect(new ShapeDrawShapeCylinder().surfacePieceMappingCreate()).toBeInstanceOf(
      ShapeDrawSurfacePieceMappingProportional,
    );
  });
});
