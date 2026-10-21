import type * as THREE from 'three';
import type { ObjectEntry, SceneJSON } from '@/io/scene/io_types.js';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Feature that stores its own data on scene objects and carries it through
 * scene files, the game preview and export. Every hook does nothing unless a
 * feature overrides it.
 */
export abstract class ObjectDataContributor {
  /** Unique name of the contributor, used in diagnostics. */
  abstract readonly contributorName: string;

  /**
   * Adds this feature's data of one object to its scene file entry.
   *
   * @param _object Live scene object.
   * @param _entry Entry being written.
   */
  sceneEntryWrite(_object: THREE.Object3D, _entry: ObjectEntry): void {}

  /**
   * Restores this feature's data of one object from its scene file entry.
   *
   * @param _entry Entry being read.
   * @param _object Object just created from the entry.
   */
  sceneEntryRead(_entry: ObjectEntry, _object: THREE.Object3D): void {}

  /**
   * Adds document-wide data after every object entry was written.
   *
   * @param _worldGroup Live world root.
   * @param _scene Scene file being written.
   */
  sceneDocumentWrite(_worldGroup: THREE.Object3D, _scene: SceneJSON): void {}

  /**
   * Reads document-wide data before any object is created.
   *
   * @param _scene Scene file being read.
   */
  sceneDocumentRead(_scene: SceneJSON): void {}

  /**
   * Copies this feature's data of one object onto a duplicate that was built
   * without it.
   *
   * @param _source Duplicated object.
   * @param _copy The new duplicate.
   */
  duplicateDataCopy(_source: THREE.Object3D, _copy: THREE.Object3D): void {}

  /**
   * Adds this feature's data of one object to the authored preview object.
   *
   * @param _object Live scene object.
   * @param _authored Preview object being built.
   */
  previewPayloadAttach(_object: THREE.Object3D, _authored: PreviewAuthoredObject): void {}

  /**
   * Builds the export children of an entity owner. The exporter wraps them in a
   * group carrying the owner's transform, identity and extras.
   *
   * @param _owner Entity owner.
   * @param _options Export behavior switches.
   * @returns Children to export, or null when this contributor does not export
   *   the owner.
   */
  exportEntityChildrenCreate(_owner: THREE.Object3D, _options: ExportSceneOptions): THREE.Object3D[] | null {
    return null;
  }

  /**
   * Writes this feature's export extras of one object onto its export node.
   *
   * @param _source Live scene object.
   * @param _target Export node whose userData becomes glTF extras.
   * @param _options Export behavior switches.
   */
  exportExtrasWrite(_source: THREE.Object3D, _target: THREE.Object3D, _options: ExportSceneOptions): void {}
}
