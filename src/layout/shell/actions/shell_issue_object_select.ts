import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { gameNoticeObjectFind, type GameNoticeObjectReference } from '@/project/issues/game_notice_object_reference.js';

/**
 * Selects one scene object together with the meshes below it.
 *
 * @param object Object to select.
 * @param selectionManager Object selection that receives it.
 * @returns True when the selection accepted it.
 */
function shellObjectSelect(object: THREE.Object3D, selectionManager: ManagerSelection): boolean {
  return selectionManager.setSelection(selectionMeshesFromHierarchyCollect([object]), [object]);
}

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
  return shellObjectSelect(issueObject, selectionManager);
}

/**
 * Selects the scene object a game warning names.
 *
 * @param reference Object the warning names.
 * @param worldObject World root that holds the object.
 * @param selectionManager Object selection that receives it.
 * @returns True when the object was found and selected.
 */
export function shellGameNoticeObjectSelect(
  reference: GameNoticeObjectReference,
  worldObject: THREE.Object3D,
  selectionManager: ManagerSelection,
): boolean {
  const noticeObject = gameNoticeObjectFind(reference, worldObject);
  return noticeObject !== null && shellObjectSelect(noticeObject, selectionManager);
}
