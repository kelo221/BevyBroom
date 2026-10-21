import type * as THREE from 'three';
import type { ObjectEntry, SceneJSON } from '@/io/scene/io_types.js';
import { LayerManagerLookup } from '@/layer/model/layer_manager_lookup.js';
import {
  layerIdStoredRead,
  layerIdStoredWrite,
  layerOfObjectResolve,
  objectInHiddenLayerIs,
} from '@/layer/model/layer_membership.js';
import { LayerDocumentCodec } from '@/layer/persistence/layer_document_codec.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Carries layers through scene files, duplicates and the game preview: the
 * layer of each top-level object, the document's layers and its current layer,
 * and the hidden state of hidden layers.
 */
export class ObjectDataContributorLayers extends ObjectDataContributor {
  readonly contributorName = 'layers';

  /**
   * Stores the layer of a top-level object of a managed world in its entry.
   *
   * @param object Live scene object.
   * @param entry Entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    const parent = object.parent;
    const layerIdentifier = layerIdStoredRead(object);
    if (parent !== null && layerIdentifier !== null && LayerManagerLookup.find(parent) !== null) {
      entry.layer = layerIdentifier;
    }
  }

  /**
   * Restores the stored layer of an object from its entry.
   *
   * @param entry Entry being read.
   * @param object Object just created from the entry.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    if (typeof entry.layer === 'string' && entry.layer.length > 0) {
      layerIdStoredWrite(object, entry.layer);
    }
  }

  /**
   * Saves the layers and the current layer of a managed world.
   *
   * @param worldGroup Live world root.
   * @param scene Scene file being written.
   */
  override sceneDocumentWrite(worldGroup: THREE.Object3D, scene: SceneJSON): void {
    const manager = LayerManagerLookup.find(worldGroup);
    if (manager !== null) {
      LayerDocumentCodec.write(manager, scene);
    }
  }

  /**
   * Leaves only the default layer in a cleared managed world.
   *
   * @param worldGroup Live world root that was cleared.
   */
  override sceneDocumentClear(worldGroup: THREE.Object3D): void {
    LayerManagerLookup.find(worldGroup)?.documentReset();
  }

  /**
   * Loads the layers and the current layer of the document being opened.
   *
   * @param scene Scene file being read.
   * @param worldGroup Live world root the document is loaded into.
   */
  override sceneDocumentRead(scene: SceneJSON, worldGroup: THREE.Object3D): void {
    const manager = LayerManagerLookup.find(worldGroup);
    if (manager !== null) {
      LayerDocumentCodec.read(manager, scene);
    }
  }

  /**
   * Puts a duplicate into the layer its source belongs to.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    const sourceLayer = layerOfObjectResolve(source);
    if (sourceLayer !== null) {
      layerIdStoredWrite(copy, sourceLayer.id);
    }
  }

  /**
   * Sends objects of hidden layers to the game as hidden.
   *
   * @param object Live scene object.
   * @param authored Preview object being built.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    if (objectInHiddenLayerIs(object)) {
      authored.visible = false;
    }
  }
}
