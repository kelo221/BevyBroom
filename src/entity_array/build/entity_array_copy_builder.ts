import type * as THREE from 'three';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import type { EntityArrayLayoutCell } from '@/entity_array/layout/entity_array_layout.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';

/**
 * Builds the copies of an array source: full copies of the entity and the
 * entities nested under it, without the source's own array copies, placed in
 * the source's space and marked with their cell and signature.
 */
export class EntityArrayCopyBuilder {
  /**
   * Builds the copies of every cell.
   *
   * @param source Array source.
   * @param cells Cells to fill, with their offsets.
   * @param signature Signature of the source and settings.
   * @returns Detached copies in cell order; empty when the source is not an
   *   entity owner.
   */
  static copiesCreate(
    source: THREE.Object3D,
    cells: readonly EntityArrayLayoutCell[],
    signature: string,
  ): THREE.Object3D[] {
    const copies: THREE.Object3D[] = [];
    for (const cell of cells) {
      const copy = EntityArrayCopyBuilder.copyCreate(source, cell, signature);
      if (copy === null) {
        return [];
      }
      copies.push(copy);
    }
    return copies;
  }

  /**
   * Builds the copy of one cell.
   *
   * @param source Array source.
   * @param cell Cell and offset of the copy.
   * @param signature Signature of the source and settings.
   * @returns Detached copy as a child of the source would stand, or null when
   *   the source is not an entity owner.
   */
  private static copyCreate(
    source: THREE.Object3D,
    cell: EntityArrayLayoutCell,
    signature: string,
  ): THREE.Object3D | null {
    const copy = CommandEntityDuplicate.ownerCopyCreate(source, (child) => !EntityArrayCopyMark.is(child));
    if (copy === null) {
      return null;
    }
    EntityArrayStore.write(copy, null);
    copy.name = `${source.name} ${cell.cell.join('.')}`;
    copy.position.copy(cell.offset);
    copy.quaternion.identity();
    copy.scale.set(1, 1, 1);
    copy.visible = true;
    EntityArrayCopyMark.write(copy, { cell: cell.cell, signature });
    return copy;
  }
}
