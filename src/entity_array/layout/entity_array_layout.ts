import * as THREE from 'three';
import type { EntityArraySettings } from '@/entity_array/model/entity_array_settings.js';

/** One copy of an array: its cell and where it stands in the source's space. */
export interface EntityArrayLayoutCell {
  readonly cell: readonly [number, number, number];
  readonly offset: THREE.Vector3;
}

/**
 * Works out where the copies of an array stand: every cell of the counts but
 * the source's own, each one footprint plus one gap further along each axis.
 */
export class EntityArrayLayout {
  /**
   * Returns the distance from one copy to the next on each axis.
   *
   * @param settings Valid array settings.
   * @param footprintSize Size of the source in its own space.
   * @returns Step per axis: the footprint plus the gap.
   */
  static stepOf(settings: EntityArraySettings, footprintSize: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      footprintSize.x + settings.gap.x,
      footprintSize.y + settings.gap.y,
      footprintSize.z + settings.gap.z,
    );
  }

  /**
   * Returns every copy of an array in a stable order, X fastest, then Z, then
   * Y, leaving out the source's own cell.
   *
   * @param settings Valid array settings.
   * @param footprintSize Size of the source in its own space.
   * @returns Copies with their cells and offsets in the source's space.
   */
  static cellsOf(settings: EntityArraySettings, footprintSize: THREE.Vector3): EntityArrayLayoutCell[] {
    const step = EntityArrayLayout.stepOf(settings, footprintSize);
    const cells: EntityArrayLayoutCell[] = [];
    for (let y = 0; y < settings.counts.y; y++) {
      for (let z = 0; z < settings.counts.z; z++) {
        for (let x = 0; x < settings.counts.x; x++) {
          if (x !== 0 || y !== 0 || z !== 0) {
            cells.push({ cell: [x, y, z], offset: new THREE.Vector3(x * step.x, y * step.y, z * step.z) });
          }
        }
      }
    }
    return cells;
  }
}
