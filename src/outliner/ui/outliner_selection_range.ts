import type * as THREE from 'three';

/**
 * Remembers the outliner row a range selection starts from and collects the
 * rows between that anchor and a clicked row, in either direction.
 */
export class OutlinerSelectionRange {
  private anchorObject: THREE.Object3D | null = null;

  /**
   * Makes a row the start of later range selections.
   *
   * @param object Object of the row.
   */
  anchorSet(object: THREE.Object3D): void {
    this.anchorObject = object;
  }

  /**
   * Returns the row range selections start from.
   *
   * @returns Anchor object, or null before any plain click.
   */
  anchorRead(): THREE.Object3D | null {
    return this.anchorObject;
  }

  /**
   * Returns every row from the anchor to a target row, inclusive, in display
   * order.
   *
   * @param visibleObjects Objects of the shown rows in display order.
   * @param targetObject Object of the clicked row.
   * @returns Rows of the range, or null when the anchor or target is not shown.
   */
  rangeCollect(visibleObjects: readonly THREE.Object3D[], targetObject: THREE.Object3D): THREE.Object3D[] | null {
    const anchorIndex = this.anchorObject === null ? -1 : visibleObjects.indexOf(this.anchorObject);
    const targetIndex = visibleObjects.indexOf(targetObject);
    if (anchorIndex < 0 || targetIndex < 0) {
      return null;
    }
    return visibleObjects.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
  }
}
