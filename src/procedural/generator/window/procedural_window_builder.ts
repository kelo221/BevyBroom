import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartBox } from '@/procedural/build/procedural_part_box.js';
import { PROCEDURAL_PART_ROLE_GLASS, proceduralPartRoleSet } from '@/procedural/build/procedural_part_role.js';
import { ProceduralLayoutRepeat } from '@/procedural/layout/procedural_layout_repeat.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

/** Material slot of the frame and the mullions. */
export const PROCEDURAL_WINDOW_SLOT_FRAME = 'frame';

/** Material slot of the glass panes. */
export const PROCEDURAL_WINDOW_SLOT_GLASS = 'glass';

/** Thickness of a glass pane, in meters, unless the window is thinner. */
export const PROCEDURAL_WINDOW_GLASS_THICKNESS = GRID_INTERVAL_MINIMUM;

/** A span between two coordinates on one axis. */
type ProceduralWindowRange = readonly [number, number];

/** Measures of a window in meters. */
export interface ProceduralWindowSpec {
  readonly box: THREE.Box3;
  readonly frameWidth: number;
  readonly mullionWidth: number;
  readonly columns: number;
  readonly rows: number;
}

/** The opening of one axis with its mullions and the cells between them. */
export interface ProceduralWindowAxisLayout {
  readonly opening: ProceduralWindowRange;
  readonly mullions: readonly ProceduralWindowRange[];
  readonly cells: readonly ProceduralWindowRange[];
}

/** Builds the frame, mullions and glass panes of a window. */
export class ProceduralWindowBuilder {
  /**
   * Splits one axis of the opening into cells separated by mullions that keep
   * their width; the mullions are spread evenly and snapped to the grid.
   *
   * @param opening Range of the opening on the axis.
   * @param count Number of cells on the axis.
   * @param mullionWidth Width of one mullion.
   * @returns The opening with its mullion and cell ranges.
   */
  static axisLayoutOf(opening: ProceduralWindowRange, count: number, mullionWidth: number): ProceduralWindowAxisLayout {
    const length = opening[1] - opening[0];
    const cellSize = ProceduralWindowBuilder.cellSizeOf(length, count, mullionWidth);
    const starts = ProceduralLayoutRepeat.positionsByCount(length - 2 * cellSize, mullionWidth, count - 1);
    const mullions = starts.map((start): ProceduralWindowRange => {
      const from = opening[0] + ProceduralLayoutRepeat.gridSnap(cellSize + start);
      return [from, from + mullionWidth];
    });
    const cells = Array.from({ length: count }, (_, index): ProceduralWindowRange => [
      mullions[index - 1]?.[1] ?? opening[0],
      mullions[index]?.[0] ?? opening[1],
    ]);
    return { opening, mullions, cells };
  }

  /**
   * Returns the size of a cell when the mullions are spread evenly.
   *
   * @param openingLength Length of the opening on the axis.
   * @param count Number of cells on the axis.
   * @param mullionWidth Width of one mullion.
   * @returns Cell size, zero or less when the cells do not fit.
   */
  static cellSizeOf(openingLength: number, count: number, mullionWidth: number): number {
    return (openingLength - (count - 1) * mullionWidth) / count;
  }

  /**
   * Describes why a window cannot be built.
   *
   * @param spec Measures of the window.
   * @returns Problem descriptions, empty when the window fits its frame and
   *   mullions.
   */
  static issuesOf(spec: ProceduralWindowSpec): string[] {
    const size = spec.box.getSize(new THREE.Vector3());
    const openingWidth = size.x - 2 * spec.frameWidth;
    const openingHeight = size.y - 2 * spec.frameWidth;
    if (openingWidth <= 0 || openingHeight <= 0) {
      return ['Window is too small for its frame'];
    }
    const cellWidth = ProceduralWindowBuilder.cellSizeOf(openingWidth, spec.columns, spec.mullionWidth);
    const cellHeight = ProceduralWindowBuilder.cellSizeOf(openingHeight, spec.rows, spec.mullionWidth);
    return cellWidth < GRID_INTERVAL_MINIMUM || cellHeight < GRID_INTERVAL_MINIMUM
      ? ['Window is too small for its columns and rows of panes']
      : [];
  }

  /**
   * Builds every part of a window.
   *
   * @param spec Measures of the window.
   * @returns Frame parts, mullion parts, then glass panes.
   */
  static build(spec: ProceduralWindowSpec): ProceduralPart[] {
    const { min, max } = spec.box;
    const edge = spec.frameWidth;
    const columns = ProceduralWindowBuilder.axisLayoutOf([min.x + edge, max.x - edge], spec.columns, spec.mullionWidth);
    const rows = ProceduralWindowBuilder.axisLayoutOf([min.y + edge, max.y - edge], spec.rows, spec.mullionWidth);
    return [
      ...ProceduralWindowBuilder.frameBuild(spec),
      ...ProceduralWindowBuilder.mullionsBuild(spec, columns, rows),
      ...ProceduralWindowBuilder.glassBuild(spec, columns, rows),
    ];
  }

  /**
   * Builds one box of the window over ranges on the three axes.
   *
   * @param name Part name.
   * @param slot Material slot of the part.
   * @param xRange Range along the width.
   * @param yRange Range along the height.
   * @param depthRange Range along the depth.
   * @returns Box part.
   */
  private static partBuild(
    name: string,
    slot: string,
    xRange: ProceduralWindowRange,
    yRange: ProceduralWindowRange,
    depthRange: ProceduralWindowRange,
  ): ProceduralPart {
    const low = new THREE.Vector3(xRange[0], yRange[0], depthRange[0]);
    const high = new THREE.Vector3(xRange[1], yRange[1], depthRange[1]);
    return ProceduralPartBox.create(name, slot, low, high);
  }

  /**
   * Builds the four frame boxes: full width bottom and top, and the sides
   * between them.
   *
   * @param spec Measures of the window.
   * @returns Bottom, top, left and right parts.
   */
  private static frameBuild(spec: ProceduralWindowSpec): ProceduralPart[] {
    const { min, max } = spec.box;
    const edge = spec.frameWidth;
    const slot = PROCEDURAL_WINDOW_SLOT_FRAME;
    const depth: ProceduralWindowRange = [min.z, max.z];
    const wide: ProceduralWindowRange = [min.x, max.x];
    const between: ProceduralWindowRange = [min.y + edge, max.y - edge];
    return [
      ProceduralWindowBuilder.partBuild('Frame Bottom', slot, wide, [min.y, min.y + edge], depth),
      ProceduralWindowBuilder.partBuild('Frame Top', slot, wide, [max.y - edge, max.y], depth),
      ProceduralWindowBuilder.partBuild('Frame Left', slot, [min.x, min.x + edge], between, depth),
      ProceduralWindowBuilder.partBuild('Frame Right', slot, [max.x - edge, max.x], between, depth),
    ];
  }

  /**
   * Builds the column mullions over the full opening height and the row
   * mullions in pieces between the column mullions.
   *
   * @param spec Measures of the window.
   * @param columns Layout along the width.
   * @param rows Layout along the height.
   * @returns Mullion parts, columns first.
   */
  private static mullionsBuild(
    spec: ProceduralWindowSpec,
    columns: ProceduralWindowAxisLayout,
    rows: ProceduralWindowAxisLayout,
  ): ProceduralPart[] {
    const slot = PROCEDURAL_WINDOW_SLOT_FRAME;
    const depth: ProceduralWindowRange = [spec.box.min.z, spec.box.max.z];
    const upright = columns.mullions.map((range, column) =>
      ProceduralWindowBuilder.partBuild(`Mullion Column ${column + 1}`, slot, range, rows.opening, depth),
    );
    const crossing = rows.mullions.flatMap((rowRange, row) =>
      columns.cells.map((cellRange, column) =>
        ProceduralWindowBuilder.partBuild(
          `Mullion Row ${row + 1} Piece ${column + 1}`,
          slot,
          cellRange,
          rowRange,
          depth,
        ),
      ),
    );
    return [...upright, ...crossing];
  }

  /**
   * Builds one thin glass pane in every cell, centered in the depth.
   *
   * @param spec Measures of the window.
   * @param columns Layout along the width.
   * @param rows Layout along the height.
   * @returns Glass parts, row by row from the bottom.
   */
  private static glassBuild(
    spec: ProceduralWindowSpec,
    columns: ProceduralWindowAxisLayout,
    rows: ProceduralWindowAxisLayout,
  ): ProceduralPart[] {
    const thickness = Math.min(PROCEDURAL_WINDOW_GLASS_THICKNESS, spec.box.max.z - spec.box.min.z);
    const middle = (spec.box.min.z + spec.box.max.z) / 2;
    const depth: ProceduralWindowRange = [middle - thickness / 2, middle + thickness / 2];
    return rows.cells.flatMap((rowRange, row) =>
      columns.cells.map((cellRange, column) => {
        const name = `Glass ${row + 1} ${column + 1}`;
        const pane = ProceduralWindowBuilder.partBuild(name, PROCEDURAL_WINDOW_SLOT_GLASS, cellRange, rowRange, depth);
        return proceduralPartRoleSet(pane, PROCEDURAL_PART_ROLE_GLASS);
      }),
    );
  }
}
