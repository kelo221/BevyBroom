import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ObjectPropertiesObjectPicker } from '@/ui/object_properties/picking/object_properties_object_picker.js';

/**
 * Creates a selection with an edited object and a picker listening to it.
 *
 * @returns Selection, edited object, picker and the consumed-change log.
 */
function pickerRigCreate(): {
  selectionManager: ManagerSelection;
  edited: THREE.Object3D;
  picker: ObjectPropertiesObjectPicker;
  consumed: boolean[];
} {
  const selectionManager = new ManagerSelection();
  const edited = new THREE.Group();
  selectionManager.setSelection([], [edited]);
  const picker = new ObjectPropertiesObjectPicker(selectionManager);
  const consumed: boolean[] = [];
  selectionManager.onSelectionChanged(() => consumed.push(picker.selectionChangeConsume()));
  return { selectionManager, edited, picker, consumed };
}

/**
 * The picker reads the next selection change as a pick and gives the edited
 * selection back, hiding both changes from the dialog.
 */
describe('ObjectPropertiesObjectPicker', () => {
  it('reports the picked object and restores the edited selection', () => {
    const { selectionManager, edited, picker, consumed } = pickerRigCreate();
    const onPicked = vi.fn();
    picker.begin(onPicked);
    const target = new THREE.Group();
    selectionManager.setSelection([], [target]);
    expect(onPicked).toHaveBeenCalledWith(target);
    expect(selectionManager.getInspectorObjects()).toEqual([edited]);
    expect(consumed.every((wasConsumed) => wasConsumed)).toBe(true);
    expect(picker.isActive()).toBe(false);
  });

  it('ends without a pick when the click selected nothing new, and ignores later changes', () => {
    const { selectionManager, picker, consumed } = pickerRigCreate();
    const onPicked = vi.fn();
    picker.begin(onPicked);
    selectionManager.clearSelection();
    expect(onPicked).not.toHaveBeenCalled();
    consumed.length = 0;
    selectionManager.setSelection([], [new THREE.Group()]);
    expect(consumed).toEqual([false]);
  });
});
