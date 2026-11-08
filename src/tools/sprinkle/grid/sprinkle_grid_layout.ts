import type * as THREE from 'three';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { SPRINKLE_GRID_SIZE_MIN, type SprinkleConfig } from '@/tools/sprinkle/sprinkle_types.js';
import type { SprinkleGridPlane } from './sprinkle_grid_plane.js';

/** One cell of a Sprinkle grid in a grid plane. */
export interface SprinkleGridCell {
  /** Key unique to the plane axis and cell indices. */
  readonly key: string;
  /** Cell index along U. */
  readonly indexU: number;
  /** Cell index along V. */
  readonly indexV: number;
  /** U coordinate of the cell center. */
  readonly centerU: number;
  /** V coordinate of the cell center. */
  readonly centerV: number;
}

/**
 * Cell size and offset of a Sprinkle grid. Cell centers sit at the offset plus
 * whole multiples of the size along each plane axis; a point belongs to the
 * cell whose center is nearest.
 */
export class SprinkleGridLayout {
  /** Cell size along U in meters. */
  readonly sizeU: number;
  /** Cell size along V in meters. */
  readonly sizeV: number;
  /** Grid shift along U in meters. */
  readonly offsetU: number;
  /** Grid shift along V in meters. */
  readonly offsetV: number;

  /**
   * Creates a layout; sizes below SPRINKLE_GRID_SIZE_MIN are raised to it.
   *
   * @param sizeU Cell size along U.
   * @param sizeV Cell size along V.
   * @param offsetU Grid shift along U.
   * @param offsetV Grid shift along V.
   */
  constructor(sizeU: number, sizeV: number, offsetU: number, offsetV: number) {
    this.sizeU = SprinkleGridLayout.sizeClamp(sizeU);
    this.sizeV = SprinkleGridLayout.sizeClamp(sizeV);
    this.offsetU = Number.isFinite(offsetU) ? offsetU : 0;
    this.offsetV = Number.isFinite(offsetV) ? offsetV : 0;
  }

  /**
   * Builds the layout a configuration asks for: the definition's grid when the
   * configuration takes it and the definition has one, else the custom size.
   *
   * @param config Sprinkle configuration.
   * @param definition Active definition, or null.
   * @returns Grid layout.
   */
  static fromConfig(config: SprinkleConfig, definition: SprinkleDefinition | null): SprinkleGridLayout {
    const definitionGrid = config.gridSizeFromDefinition ? (definition?.grid ?? null) : null;
    const sizeU = definitionGrid ? definitionGrid.sizeU : config.gridSizeU;
    const sizeV = definitionGrid ? definitionGrid.sizeV : config.gridSizeV;
    return new SprinkleGridLayout(sizeU, sizeV, config.gridOffsetU, config.gridOffsetV);
  }

  /**
   * Returns the cell with given indices in a plane.
   *
   * @param plane Grid plane.
   * @param indexU Cell index along U.
   * @param indexV Cell index along V.
   * @returns Grid cell.
   */
  cellAt(plane: SprinkleGridPlane, indexU: number, indexV: number): SprinkleGridCell {
    return {
      key: `${plane.normalAxis}:${indexU}:${indexV}`,
      indexU,
      indexV,
      centerU: this.offsetU + indexU * this.sizeU,
      centerV: this.offsetV + indexV * this.sizeV,
    };
  }

  /**
   * Returns the cell a world point belongs to in a plane.
   *
   * @param plane Grid plane.
   * @param point World point.
   * @returns Cell whose center is nearest the point.
   */
  cellOf(plane: SprinkleGridPlane, point: THREE.Vector3): SprinkleGridCell {
    const indexU = Math.round((plane.uRead(point) - this.offsetU) / this.sizeU);
    const indexV = Math.round((plane.vRead(point) - this.offsetV) / this.sizeV);
    return this.cellAt(plane, indexU, indexV);
  }

  /**
   * Returns half the diagonal of one cell.
   *
   * @returns Distance from a cell center to its corners in meters.
   */
  cellHalfDiagonal(): number {
    return Math.hypot(this.sizeU, this.sizeV) / 2;
  }

  /**
   * Raises a size to the smallest allowed grid size.
   *
   * @param size Requested size.
   * @returns Usable size.
   */
  private static sizeClamp(size: number): number {
    return Number.isFinite(size) ? Math.max(SPRINKLE_GRID_SIZE_MIN, size) : SPRINKLE_GRID_SIZE_MIN;
  }
}
