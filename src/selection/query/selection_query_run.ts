import type * as THREE from 'three';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectableMeshesCollect } from '@/selection/object/selectable_mesh_filter.js';
import type { SelectionQuery } from './selection_query.js';

/**
 * Runs a selection query over the scene and replaces the object selection with
 * its result.
 *
 * @param query Query to run.
 * @param selectionManager Object selection to replace.
 * @param worldObject Scene root holding the selectable meshes.
 * @returns Number of selected meshes afterwards.
 */
export function selectionQueryRun(
  query: SelectionQuery,
  selectionManager: ManagerSelection,
  worldObject: THREE.Object3D,
): number {
  const selected = selectionManager.getAllSelectedObjectsAsArray();
  if (query.needsSelection && selected.length === 0) {
    return 0;
  }
  const result = query.select(selectableMeshesCollect(worldObject), selected);
  selectionManager.setSelection(result);
  return result.length;
}
