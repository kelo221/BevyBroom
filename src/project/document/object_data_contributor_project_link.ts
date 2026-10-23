import type * as THREE from 'three';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { documentProjectLinkRead, documentProjectLinkWrite } from '@/project/document/document_project_link.js';

/** Carries the project a document belongs to through scene files. */
export class ObjectDataContributorProjectLink extends ObjectDataContributor {
  readonly contributorName = 'project_link';

  /**
   * Saves the project of the document.
   *
   * @param worldGroup Live world root.
   * @param scene Scene file being written.
   */
  override sceneDocumentWrite(worldGroup: THREE.Object3D, scene: SceneJSON): void {
    const projectIdentifier = documentProjectLinkRead(worldGroup);
    if (projectIdentifier !== null) {
      scene.projectId = projectIdentifier;
    }
  }

  /**
   * Forgets the project of a cleared document.
   *
   * @param worldGroup Live world root that was cleared.
   */
  override sceneDocumentClear(worldGroup: THREE.Object3D): void {
    documentProjectLinkWrite(worldGroup, '');
  }

  /**
   * Restores the project of the document being opened.
   *
   * @param scene Scene file being read.
   * @param worldGroup Live world root the document is loaded into.
   */
  override sceneDocumentRead(scene: SceneJSON, worldGroup: THREE.Object3D): void {
    documentProjectLinkWrite(worldGroup, typeof scene.projectId === 'string' ? scene.projectId : '');
  }
}
