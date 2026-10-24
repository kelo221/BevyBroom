import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';

/** Callback for status messages. */
export type MaterialUsageStatusCallback = (message: string) => void;

/** Finds and selects the faces or objects that use a material in the open world. */
export class ControllerMaterialUsage {
  private worldObject: THREE.Group;
  private selectionManager: ManagerSelection;
  private faceExtrusionController: ControllerFaceExtrusion;
  private statusCallback: MaterialUsageStatusCallback | null;

  /**
   * Creates the material usage controller.
   *
   * @param worldObject Editor world root.
   * @param selectionManager Object selection.
   * @param faceExtrusionController Face selection controller.
   */
  constructor(
    worldObject: THREE.Group,
    selectionManager: ManagerSelection,
    faceExtrusionController: ControllerFaceExtrusion,
  ) {
    this.worldObject = worldObject;
    this.selectionManager = selectionManager;
    this.faceExtrusionController = faceExtrusionController;
    this.statusCallback = null;
  }

  /**
   * Registers a status message callback.
   *
   * @param callback Status handler, or null.
   */
  setStatusCallback(callback: MaterialUsageStatusCallback | null): void {
    this.statusCallback = callback;
  }

  /**
   * Selects every face region whose stored mapping uses a texture, switching to
   * face mode first.
   *
   * @param textureId Material identity.
   * @returns Number of face regions selected.
   */
  selectFacesUsingTexture(textureId: string): number {
    const regions = this.collectRegionsUsingTexture(textureId);
    if (regions.length === 0) {
      this.statusCallback?.('No faces use this material');
      return 0;
    }
    this.faceExtrusionController.setSelectionMode(SelectionMode.FACE);
    regions.forEach((region, index) => {
      this.faceExtrusionController.selectFace(region.mesh, region.seedFaceIndex, index > 0);
    });
    this.statusCallback?.(`Selected ${regions.length} face(s) using the material`);
    return regions.length;
  }

  /**
   * Selects every object with a surface using a texture.
   *
   * @param textureId Material identity.
   * @returns Number of objects selected.
   */
  selectObjectsUsingTexture(textureId: string): number {
    const meshes = this.collectMeshesUsingTexture(textureId);
    if (meshes.length === 0) {
      this.statusCallback?.('No objects use this material');
      return 0;
    }
    this.selectionManager.setSelection(meshes);
    this.statusCallback?.(`Selected ${meshes.length} object(s) using the material`);
    return meshes.length;
  }

  /**
   * Collects the selectable face regions whose stored mapping uses a texture.
   *
   * @param textureId Material identity.
   * @returns Regions with a seed face index.
   */
  private collectRegionsUsingTexture(textureId: string): Array<{ mesh: THREE.Mesh; seedFaceIndex: number }> {
    const regions: Array<{ mesh: THREE.Mesh; seedFaceIndex: number }> = [];
    this.worldObject.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      getFaceTextureMaps(child).forEach((entry) => {
        const seedFaceIndex = entry.triangleIndices[0];
        if (seedFaceIndex === undefined) return;
        if (entry.mapping.textureId !== textureId) return;
        regions.push({ mesh: child, seedFaceIndex });
      });
    });
    return regions;
  }

  /**
   * Collects the selectable meshes with any surface using a texture.
   *
   * @param textureId Material identity.
   * @returns Meshes using the texture.
   */
  private collectMeshesUsingTexture(textureId: string): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    this.worldObject.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (this.meshUsesTexture(child, textureId)) {
        meshes.push(child);
      }
    });
    return meshes;
  }

  /**
   * Returns whether any surface of a mesh uses a texture.
   *
   * @param mesh Candidate mesh.
   * @param textureId Material identity.
   * @returns True when the mesh uses the texture.
   */
  private meshUsesTexture(mesh: THREE.Mesh, textureId: string): boolean {
    if (SolidModel.isResultMesh(mesh)) {
      return this.solidModelUsesTexture(mesh, textureId);
    }
    if (SolidBrushVisual.isBrushObject(mesh)) {
      return this.solidModelUsesTexture(mesh.parent ?? mesh, textureId);
    }
    return getFaceTextureMaps(mesh).some((entry) => entry.mapping.textureId === textureId);
  }

  /**
   * Returns whether any brush face of a solid model uses a texture.
   *
   * @param candidate Solid result mesh or an object under it.
   * @param textureId Material identity.
   * @returns True when a brush face uses the texture.
   */
  private solidModelUsesTexture(candidate: THREE.Object3D, textureId: string): boolean {
    const model = SolidModel.fromObject(candidate);
    if (!model) {
      return false;
    }
    return model.getBrushes().some((brush) => this.brushUsesTexture(brush, textureId));
  }

  /**
   * Returns whether any face of one brush uses a texture.
   *
   * @param brush Brush instance.
   * @param textureId Material identity.
   * @returns True when a brush face uses the texture.
   */
  private brushUsesTexture(brush: SolidBrushInstance, textureId: string): boolean {
    const faceCount = brush.brush.faces.length;
    for (let surfaceIndex = 0; surfaceIndex < faceCount; surfaceIndex++) {
      if (brush.getSurfaceTextureId(surfaceIndex) === textureId) {
        return true;
      }
    }
    return false;
  }
}
