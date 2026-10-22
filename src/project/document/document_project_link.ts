import type * as THREE from 'three';

/** World-root userData key holding the project the document belongs to. */
export const DOCUMENT_PROJECT_LINK_USERDATA_KEY = 'broomProjectId';

/**
 * Reads the project the open document belongs to.
 *
 * @param worldGroup Editor world root.
 * @returns Project id, or null when the document belongs to no project yet.
 */
export function documentProjectLinkRead(worldGroup: THREE.Object3D): string | null {
  const stored = worldGroup.userData[DOCUMENT_PROJECT_LINK_USERDATA_KEY];
  return typeof stored === 'string' && stored.length > 0 ? stored : null;
}

/**
 * Links the open document to a project.
 *
 * @param worldGroup Editor world root.
 * @param projectIdentifier Project id; empty removes the link.
 */
export function documentProjectLinkWrite(worldGroup: THREE.Object3D, projectIdentifier: string): void {
  if (projectIdentifier.length === 0) {
    delete worldGroup.userData[DOCUMENT_PROJECT_LINK_USERDATA_KEY];
    return;
  }
  worldGroup.userData[DOCUMENT_PROJECT_LINK_USERDATA_KEY] = projectIdentifier;
}
