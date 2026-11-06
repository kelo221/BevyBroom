import * as THREE from 'three';
import { entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandTextureSurfaceAssign } from '@/texture/commands/command_texture_surface_assign.js';
import { CommandTextureSolidBrushAssign } from '@/texture/commands/command_texture_solid_brush_assign.js';
import { CommandTextureSolidFaceAssign } from '@/texture/commands/command_texture_solid_face_assign.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { SelectionMode } from '@/types/selection_mode.js';
import {
  TextureApplyTarget,
  buildTargetsFromFaceSelection,
  buildTargetsFromMeshes,
} from '@/texture/uv/face_texture_applier.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { solidFaceTargetFromResultTriangle } from '@/selection/face/solid_face_target_resolver.js';
import { mapPreviewTriangleToBrushFace } from '@/solid/model/brush_preview_face_map.js';
import { ModifierVolumeBevel } from '@/modifier/volume/modifier_volume_bevel.js';

/**
 * Callback for status messages after texture assignment.
 *
 * @param message Status text.
 */
export type TextureAssignmentStatusCallback = (message: string) => void;

/** Texture identity and display name an assignment paints. */
export interface TextureAssignmentChoice {
  /** Durable texture identity. */
  readonly id: string;
  /** Name shown in status messages. */
  readonly displayName: string;
}

/** Undoable texture assignment of face regions, built but not yet executed. */
export interface FaceTextureAssignment {
  /** Command painting the faces. */
  readonly command: UndoCommand;
  /** Number of painted brush faces or content regions. */
  readonly regionCount: number;
  /** True when the command paints solid brush faces. */
  readonly isSolid: boolean;
}

/**
 * Assigns browser textures to regular content or solid-model brush surfaces.
 * Face mode paints individual solid faces; object mode paints whole brushes.
 */
export class ControllerTextureAssignment {
  private selectionManager: ManagerSelection;
  private faceExtrusionController: ControllerFaceExtrusion;
  private commandStack: CommandStack;
  private statusCallback: TextureAssignmentStatusCallback | null;
  private afterSolidTextureAssign: (() => void) | null;

  /**
   * Creates a texture assignment controller.
   *
   * @param selectionManager Object selection.
   * @param faceExtrusionController Face selection / mode.
   * @param commandStack Undo stack.
   */
  constructor(
    selectionManager: ManagerSelection,
    faceExtrusionController: ControllerFaceExtrusion,
    commandStack: CommandStack,
  ) {
    this.selectionManager = selectionManager;
    this.faceExtrusionController = faceExtrusionController;
    this.commandStack = commandStack;
    this.statusCallback = null;
    this.afterSolidTextureAssign = null;
  }

  /**
   * Registers a status callback.
   *
   * @param callback Status handler, or null.
   */
  setStatusCallback(callback: TextureAssignmentStatusCallback | null): void {
    this.statusCallback = callback;
  }

  /**
   * Optional viewport refresh after solid CSG texture rebuilds.
   *
   * @param callback Refresh hook, or null.
   */
  setAfterSolidTextureAssign(callback: (() => void) | null): void {
    this.afterSolidTextureAssign = callback;
  }

  /**
   * Records paint texture and assigns it to the current selection when any.
   *
   * @param entry Selected browser entry.
   */
  onTextureSelected(entry: TextureBrowserEntry): void {
    getStateTexturePaint().setLastTextureId(entry.id);
    this.assignTextureToSelection(entry);
  }

  /**
   * Assigns a texture to the selected faces in face mode, or to the selected
   * objects otherwise, without changing the current paint texture.
   *
   * @param choice Texture identity and display name to assign.
   */
  assignTextureToSelection(choice: TextureAssignmentChoice): void {
    if (this.faceExtrusionController.getSelectionMode() === SelectionMode.FACE) {
      this.assignFaceSelection(choice);
      return;
    }
    this.assignObjectSelection(choice);
  }

  /**
   * Assigns a texture to the given faces as one undo step, keeping each face's
   * alignment.
   *
   * @param faces Faces to paint.
   * @param choice Texture identity and display name to assign.
   * @returns True when any face was painted.
   */
  assignTextureToFaces(faces: readonly FaceSelection[], choice: TextureAssignmentChoice): boolean {
    const assignment = this.faceTextureAssignmentBuild(faces, choice.id);
    if (!assignment) {
      return false;
    }
    this.commandStack.push(assignment.command);
    if (assignment.isSolid) {
      this.afterSolidTextureAssign?.();
    }
    const regionNoun = assignment.isSolid ? 'solid face(s)' : 'surface region(s)';
    this.statusCallback?.(`Assigned ${choice.displayName} to ${assignment.regionCount} ${regionNoun}`);
    return true;
  }

  /**
   * Builds the not yet executed undoable texture assignment of the given faces:
   * solid brush faces when any are given, otherwise content mesh regions.
   *
   * @param faces Faces to paint.
   * @param textureId Texture identity.
   * @returns Command with its painted region count, or null when no face can be
   *   painted.
   */
  faceTextureAssignmentBuild(faces: readonly FaceSelection[], textureId: string): FaceTextureAssignment | null {
    const solidTargets = this.resolveSolidFaceTargets([...faces]);
    if (solidTargets.length > 0) {
      return {
        command: new CommandTextureSolidFaceAssign(solidTargets, textureId),
        regionCount: solidTargets.length,
        isSolid: true,
      };
    }
    const contentTargets = buildTargetsFromFaceSelection(faces.filter((face) => this.isContentTextureMesh(face.mesh)));
    if (contentTargets.length === 0) {
      return null;
    }
    return {
      command: new CommandTextureSurfaceAssign(contentTargets, textureId),
      regionCount: contentTargets.length,
      isSolid: false,
    };
  }

  /**
   * Paints selected solid or content faces, or reports that faces are required.
   *
   * @param choice Texture identity and display name.
   */
  private assignFaceSelection(choice: TextureAssignmentChoice): void {
    if (this.assignTextureToFaces(this.faceExtrusionController.getSelectedFaces(), choice)) {
      return;
    }
    this.statusCallback?.(`Paint texture: ${choice.displayName} (select faces to assign)`);
  }

  /**
   * Paints selected objects, skipping a selection that is only bevel volumes.
   *
   * @param entry Texture identity and display name.
   */
  private assignObjectSelection(entry: TextureAssignmentChoice): void {
    const meshes = this.selectionManager.getAllSelectedObjectsAsArray();
    if (this.selectionIsOnlyBevelVolumes(meshes)) {
      this.statusCallback?.('Bevel volumes keep their texture in the volume settings');
      return;
    }
    this.assignObjectTargets(meshes, entry);
  }

  /**
   * Paints solid brushes or content meshes in the object selection.
   *
   * @param meshes Current object selection.
   * @param entry Texture identity and display name.
   */
  private assignObjectTargets(meshes: THREE.Mesh[], entry: TextureAssignmentChoice): void {
    const solidBrushes = CommandTextureSolidBrushAssign.filterBrushMeshes(meshes);
    if (solidBrushes.length > 0) {
      this.assignSolidBrushTextures(solidBrushes, entry);
      return;
    }
    const targets = this.collectContentObjectTargets(meshes);
    if (targets.length === 0) {
      this.statusCallback?.(`Paint texture: ${entry.displayName} (select faces, objects, or solid brushes)`);
      return;
    }
    this.assignTextureToTargets(targets, entry);
  }

  /**
   * Maps selected triangles on solid result/brush meshes to brush face targets.
   *
   * @param faces Face selections.
   * @returns Unique solid face paint targets.
   */
  private resolveSolidFaceTargets(
    faces: FaceSelection[],
  ): Array<{ model: SolidModel; brushId: string; surfaceIndex: number }> {
    const targets: Array<{
      model: SolidModel;
      brushId: string;
      surfaceIndex: number;
    }> = [];
    const seen = new Set<string>();
    for (const face of faces) {
      const resolved = this.resolveOneSolidFace(face);
      if (!resolved) continue;
      const key = `${resolved.model.root.uuid}:${resolved.brushId}:${resolved.surfaceIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(resolved);
    }
    return targets;
  }

  /**
   * Resolves one face selection to a brush surface when possible.
   *
   * @param face Face selection entry.
   * @returns Solid face target or null.
   */
  private resolveOneSolidFace(
    face: FaceSelection,
  ): { model: SolidModel; brushId: string; surfaceIndex: number } | null {
    if (SolidModel.isResultMesh(face.mesh)) {
      return this.resolveResultTriangle(face.mesh, face.faceIndex);
    }
    if (SolidBrushVisual.isBrushObject(face.mesh)) {
      return this.resolveBrushTriangle(face.mesh, face.faceIndex);
    }
    return null;
  }

  /**
   * Maps a result-mesh triangle back to its originating brush face.
   *
   * @param mesh Result mesh.
   * @param triangleIndex Triangle index.
   * @returns Solid face target or null.
   */
  private resolveResultTriangle(
    mesh: THREE.Mesh,
    triangleIndex: number,
  ): { model: SolidModel; brushId: string; surfaceIndex: number } | null {
    return solidFaceTargetFromResultTriangle(mesh, triangleIndex);
  }

  /**
   * Maps a brush-preview triangle to a brush face by normal matching.
   * BoxGeometry face order differs from solid wing-edge face order.
   *
   * @param mesh Brush preview mesh.
   * @param triangleIndex Triangle index on the preview.
   * @returns Solid face target or null.
   */
  private resolveBrushTriangle(
    mesh: THREE.Mesh,
    triangleIndex: number,
  ): { model: SolidModel; brushId: string; surfaceIndex: number } | null {
    const model = SolidModel.fromObject(mesh);
    if (!model) return null;
    const brush = model.findBrushByMesh(mesh);
    if (!brush) return null;
    mesh.updateMatrix();
    const surfaceIndex = mapPreviewTriangleToBrushFace(mesh, triangleIndex, brush);
    if (surfaceIndex < 0) return null;
    return {
      model,
      brushId: brush.id,
      surfaceIndex,
    };
  }

  /**
   * Assigns texture to solid brushes and rebuilds their CSG results.
   *
   * @param brushMeshes Selected solid brush meshes.
   * @param entry Texture identity and display name.
   */
  private assignSolidBrushTextures(brushMeshes: THREE.Mesh[], entry: TextureAssignmentChoice): void {
    const command = new CommandTextureSolidBrushAssign(brushMeshes, entry.id);
    this.commandStack.push(command);
    this.afterSolidTextureAssign?.();
    this.statusCallback?.(`Assigned ${entry.displayName} to ${brushMeshes.length} solid brush(es)`);
  }

  /**
   * Pushes an undoable assignment for regular content mesh targets.
   *
   * @param targets Regions to paint.
   * @param entry Texture identity and display name.
   */
  private assignTextureToTargets(targets: TextureApplyTarget[], entry: TextureAssignmentChoice): void {
    const command = new CommandTextureSurfaceAssign(targets, entry.id);
    this.commandStack.push(command);
    this.statusCallback?.(`Assigned ${entry.displayName} to ${targets.length} surface region(s)`);
  }

  /**
   * Object-mode targets for regular content meshes only.
   *
   * @param selectedMeshes Current object selection.
   * @returns Apply targets.
   */
  private collectContentObjectTargets(selectedMeshes: THREE.Mesh[]): TextureApplyTarget[] {
    const contentMeshes = selectedMeshes.filter((mesh) => this.isContentTextureMesh(mesh));
    if (contentMeshes.length === 0) return [];
    return buildTargetsFromMeshes(contentMeshes);
  }

  /**
   * Returns whether a mesh may receive freeform content texture paint.
   *
   * @param mesh Candidate mesh.
   * @returns True for regular content meshes.
   */
  private isContentTextureMesh(mesh: THREE.Mesh): boolean {
    if (SolidBrushVisual.isBrushObject(mesh)) return false;
    if (SolidModel.isResultMesh(mesh)) return false;
    if (ModifierVolumeBevel.isVolume(mesh)) return false;
    if (entityVisualPartIs(mesh)) return false;
    return true;
  }

  /**
   * Returns whether every selected mesh is a bevel volume.
   *
   * @param meshes Current object selection.
   * @returns True when there is nothing to paint except volumes.
   */
  private selectionIsOnlyBevelVolumes(meshes: readonly THREE.Object3D[]): boolean {
    return meshes.length > 0 && meshes.every((mesh) => ModifierVolumeBevel.isVolume(mesh));
  }
}
