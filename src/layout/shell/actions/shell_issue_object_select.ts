import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';

/**
 * Selects the scene object an issue is about.
 *
 * @param issue Activated issue.
 * @param worldObject World root that holds the object.
 * @param selectionManager Object selection that receives it.
 * @returns True when the object was found and selected.
 */
export function shellIssueObjectSelect(
  issue: Issue,
  worldObject: THREE.Object3D,
  selectionManager: ManagerSelection,
): boolean {
  if (issue.objectUuid === null) {
    return false;
  }
  const issueObject = worldObject.getObjectByProperty('uuid', issue.objectUuid);
  if (!issueObject) {
    return false;
  }
  return selectionManager.setSelection(selectionMeshesFromHierarchyCollect([issueObject]), [issueObject]);
}
