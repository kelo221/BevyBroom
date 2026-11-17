import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OutlinerSelectionRange } from '@/outliner/ui/outliner_selection_range.js';

/**
 * Creates named objects standing for shown outliner rows.
 *
 * @param rowCount Number of rows.
 * @returns Row objects in display order.
 */
function rowObjectsCreate(rowCount: number): THREE.Object3D[] {
  return Array.from({ length: rowCount }, (_, index) => Object.assign(new THREE.Object3D(), { name: `Row${index}` }));
}

/**
 * The selection range collects the shown rows between the anchor row and a
 * clicked row in display order, whichever of the two comes first.
 */
describe('OutlinerSelectionRange', () => {
  it('collects the rows from the anchor down to a lower row', () => {
    const rows = rowObjectsCreate(6);
    const range = new OutlinerSelectionRange();
    range.anchorSet(rows[1] ?? rows[0] ?? new THREE.Object3D());
    expect(range.rangeCollect(rows, rows[4] ?? new THREE.Object3D())).toEqual(rows.slice(1, 5));
  });

  it('collects the rows from the anchor up to a higher row in display order', () => {
    const rows = rowObjectsCreate(6);
    const range = new OutlinerSelectionRange();
    range.anchorSet(rows[4] ?? new THREE.Object3D());
    expect(range.rangeCollect(rows, rows[1] ?? new THREE.Object3D())).toEqual(rows.slice(1, 5));
  });

  it('returns null before an anchor is set or when the anchor row is not shown', () => {
    const rows = rowObjectsCreate(3);
    const range = new OutlinerSelectionRange();
    expect(range.rangeCollect(rows, rows[2] ?? new THREE.Object3D())).toBeNull();
    range.anchorSet(new THREE.Object3D());
    expect(range.rangeCollect(rows, rows[2] ?? new THREE.Object3D())).toBeNull();
  });
});
