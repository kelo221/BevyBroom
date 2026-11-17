import * as THREE from 'three';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { SolidModelCodec, type SerializedSolidModel } from '@/solid/io/solid_model_codec.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/**
 * Name of the throwaway solid model that compiles a prefab's brushes for its
 * preview.
 */
const PREFAB_PREVIEW_SOLID_MODEL_NAME = 'Prefab Preview';

/**
 * Builds standalone 3D previews of prefabs: the captured objects and the
 * compiled brush geometry, never added to the map.
 */
export class PrefabPreviewBuilder {
  /**
   * Builds the preview of a prefab payload at the position it was captured at.
   *
   * @param payload Captured objects and brushes; not changed.
   * @returns Group holding the objects and the compiled brushes.
   */
  static previewCreate(payload: ClipboardPayload): THREE.Group {
    const preview = new THREE.Group();
    PrefabPreviewBuilder.objectsCreate(payload.objects).forEach((object) => preview.add(object));
    const brushMesh = PrefabPreviewBuilder.brushMeshCreate(payload.brushes);
    if (brushMesh !== null) {
      preview.add(brushMesh);
    }
    preview.updateMatrixWorld(true);
    return preview;
  }

  /**
   * Creates the captured objects from copies of their scene entries.
   *
   * @param entries Scene entries of the captured objects.
   * @returns Top-level objects.
   */
  private static objectsCreate(entries: readonly ObjectEntry[]): THREE.Object3D[] {
    const entryCopies = JSON.parse(JSON.stringify(entries)) as ObjectEntry[];
    return new SceneDeserializer().objectsCreateFromEntries(entryCopies);
  }

  /**
   * Compiles the captured brushes in a throwaway solid model and returns its
   * result mesh.
   *
   * @param brushes Captured brushes in world space.
   * @returns Compiled mesh, or null when the prefab has no brushes.
   */
  private static brushMeshCreate(brushes: SerializedSolidModel): THREE.Mesh | null {
    if (brushes.brushes.length === 0) {
      return null;
    }
    const model = new SolidModel(PREFAB_PREVIEW_SOLID_MODEL_NAME);
    SolidModelCodec.decodeNodesInto(model, JSON.parse(JSON.stringify(brushes)) as SerializedSolidModel);
    model.rebuild(true);
    model.root.updateMatrixWorld(true);
    const resultMesh = model.getResultMesh();
    const previewMesh = new THREE.Mesh(resultMesh.geometry, resultMesh.material);
    previewMesh.applyMatrix4(resultMesh.matrixWorld);
    return previewMesh;
  }
}
