import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import { shellIssueObjectSelect } from '@/layout/shell/actions/shell_issue_object_select.js';

/**
 * Creates an issue about one object.
 *
 * @param objectUuid Uuid of the object, or null for a map-wide issue.
 * @returns Issue.
 */
function issueAboutCreate(objectUuid: string | null): Issue {
  return {
    id: `issue-${objectUuid ?? 'map'}`,
    severity: 'warning',
    objectUuid,
    objectName: 'Object',
    description: 'Something is wrong',
    providerId: 'test_provider',
  };
}

/**
 * Creates a world with a group holding one box mesh.
 *
 * @returns World root and the nested mesh.
 */
function worldWithNestedMeshCreate(): { worldObject: THREE.Group; mesh: THREE.Mesh } {
  const worldObject = new THREE.Group();
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  group.add(mesh);
  worldObject.add(group);
  return { worldObject, mesh };
}

describe('shellIssueObjectSelect', () => {
  it('selects the object an issue is about even when it is nested', () => {
    const { worldObject, mesh } = worldWithNestedMeshCreate();
    const selectionManager = new ManagerSelection();
    expect(shellIssueObjectSelect(issueAboutCreate(mesh.uuid), worldObject, selectionManager)).toBe(true);
    expect(selectionManager.getAllSelectedObjectsAsArray()).toContain(mesh);
  });

  it('leaves the selection alone for map-wide issues and objects that no longer exist', () => {
    const { worldObject, mesh } = worldWithNestedMeshCreate();
    const selectionManager = new ManagerSelection();
    selectionManager.setSelection([mesh]);
    const removedObject = new THREE.Object3D();
    expect(shellIssueObjectSelect(issueAboutCreate(null), worldObject, selectionManager)).toBe(false);
    expect(shellIssueObjectSelect(issueAboutCreate(removedObject.uuid), worldObject, selectionManager)).toBe(false);
    expect(selectionManager.getAllSelectedObjectsAsArray()).toEqual([mesh]);
  });
});
