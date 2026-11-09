import * as THREE from 'three';
import type { SprinkleBrushVolume } from '@/tools/sprinkle/brush/sprinkle_brush_volume.js';
import type { SprinkleGridLayout } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';

/**
 * Sprinkled entities near a dab grouped by the grid cell their world position
 * belongs to in the dab's grid plane.
 */
export class SprinkleCellOccupancy {
  private readonly occupantsByCellKey = new Map<string, THREE.Object3D[]>();

  /**
   * Groups the sprinkled entities inside a dab volume, widened by half a cell
   * diagonal so occupants of border cells are found.
   *
   * @param sprinkled Sprinkled entities in the world.
   * @param volume Dab volume.
   * @param layout Grid layout.
   */
  constructor(sprinkled: readonly THREE.Object3D[], volume: SprinkleBrushVolume, layout: SprinkleGridLayout) {
    const margin = layout.cellHalfDiagonal();
    const worldPosition = new THREE.Vector3();
    for (const entity of sprinkled) {
      entity.getWorldPosition(worldPosition);
      if (volume.contains(worldPosition, margin)) {
        this.occupantAdd(layout.cellOf(volume.plane, worldPosition).key, entity);
      }
    }
  }

  /**
   * Returns the sprinkled entities a cell holds.
   *
   * @param cellKey Grid cell key.
   * @returns Occupants; empty when the cell is free.
   */
  occupantsRead(cellKey: string): readonly THREE.Object3D[] {
    return this.occupantsByCellKey.get(cellKey) ?? [];
  }

  /**
   * Files an entity under a cell.
   *
   * @param cellKey Grid cell key.
   * @param entity Sprinkled entity.
   */
  private occupantAdd(cellKey: string, entity: THREE.Object3D): void {
    const occupants = this.occupantsByCellKey.get(cellKey);
    if (occupants) {
      occupants.push(entity);
    } else {
      this.occupantsByCellKey.set(cellKey, [entity]);
    }
  }
}
