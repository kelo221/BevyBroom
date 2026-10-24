import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { syncMeshDocumentCornerUvsFromDisplayMesh } from '@/mesh/convert/mesh_document_face_texture_sync.js';
import { rebuildSurfaceMaterials } from '@/texture/material/builder_surface_material.js';
import { bakeFaceUVs } from '@/texture/uv/planar_uv_projector.js';
import { resolveTargetMapping, TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { upsertFaceTextureMap } from '@/texture/uv/face_texture_storage.js';
import { transferUvMappingAcrossFaces } from '@/texture/uv/uv_smear_transfer.js';
import { CommandTextureUvStrokeSmear, SmearMeshSnapshot } from '@/texture/commands/command_texture_uv_stroke_smear.js';
import { restoreUvTransformSnapshot } from '@/texture/interactive/commands/command_texture_uv_transform.js';

/**
 * Undoable command that copies one face region's material and alignment onto
 * other face regions. The UV matrix is transferred across faces so textures
 * continue across shared edges where possible. One command is one undo step.
 */
export class CommandTextureFaceAttributeTransfer implements UndoCommand {
  private readonly source: TextureApplyTarget;
  private readonly targets: TextureApplyTarget[];
  private beforeSnapshots: SmearMeshSnapshot[];
  private executed: boolean;

  /**
   * Creates an attribute transfer command.
   *
   * @param source Face region whose material and alignment are copied.
   * @param targets Face regions receiving the material and alignment.
   */
  constructor(source: TextureApplyTarget, targets: TextureApplyTarget[]) {
    this.source = source;
    this.targets = targets;
    this.beforeSnapshots = [];
    this.executed = false;
  }

  /** Applies the transferred mappings and snapshots the prior state. */
  execute(): void {
    if (this.executed) return;
    this.beforeSnapshots = this.captureTargetMeshes();
    this.applyTransfers();
    this.executed = true;
  }

  /** Restores the prior maps, UVs, materials, and solid brush faces. */
  undo(): void {
    if (!this.executed) return;
    this.beforeSnapshots.forEach((snapshot) => restoreUvTransformSnapshot(snapshot));
    this.executed = false;
  }

  /**
   * Snapshots every unique mesh the transfer writes to.
   *
   * @returns Mesh state before the transfer.
   */
  private captureTargetMeshes(): SmearMeshSnapshot[] {
    const meshes = new Set<THREE.Mesh>();
    this.targets.forEach((target) => meshes.add(target.mesh));
    return Array.from(meshes).map((mesh) => CommandTextureUvStrokeSmear.captureMesh(mesh));
  }

  /** Writes the transferred mapping onto every target region. */
  private applyTransfers(): void {
    const sourceMapping = resolveTargetMapping(this.source);
    this.targets.forEach((target) => {
      this.applyTransferToTarget(sourceMapping, target);
    });
  }

  /**
   * Transfers the source mapping onto one target region and bakes it.
   *
   * @param sourceMapping Source mapping with the material to copy.
   * @param target Region receiving the material and alignment.
   */
  private applyTransferToTarget(
    sourceMapping: ReturnType<typeof resolveTargetMapping>,
    target: TextureApplyTarget,
  ): void {
    const transferred = transferUvMappingAcrossFaces(
      this.source.mesh,
      this.source.triangleIndices,
      sourceMapping,
      target.mesh,
      target.triangleIndices,
    );
    transferred.textureId = sourceMapping.textureId;
    upsertFaceTextureMap(target.mesh, target.triangleIndices, transferred);
    bakeFaceUVs(target.mesh, target.triangleIndices, transferred);
    rebuildSurfaceMaterials(target.mesh, undefined, undefined, {
      preserveTriangleOrder: true,
    });
    syncMeshDocumentCornerUvsFromDisplayMesh(target.mesh);
    this.syncSolidBrushMapping(target, transferred);
  }

  /**
   * Writes a transferred result-mesh region onto its solid brush face so CSG
   * rebuilds keep the transferred phase and scale.
   *
   * @param target Region that may live on a solid result.
   * @param mapping Transferred mapping applied to the region.
   */
  private syncSolidBrushMapping(target: TextureApplyTarget, mapping: ReturnType<typeof resolveTargetMapping>): void {
    if (!SolidModel.isResultMesh(target.mesh)) return;
    const model = SolidModel.fromObject(target.mesh);
    if (!model) return;
    model.syncAuthoredMappingForTriangles(target.triangleIndices, mapping);
  }
}
