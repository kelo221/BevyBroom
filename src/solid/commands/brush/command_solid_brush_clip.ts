import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushPlaneClip } from '@/solid/brush/solid_brush_plane_clip.js';
import { solidBrushPreviewSwap } from '@/solid/brush/solid_brush_preview_swap.js';
import {
  applyTransferredSurfacesToInstance,
  captureInstanceFaceSurfaces,
} from '@/solid/brush/solid_brush_surface_transfer.js';
import type {
  FaceSurfaceDescription,
  FaceSurfaceDescriptionSerialized,
} from '@/texture/uv_matrix/face_surface_description.js';
import { cloneFaceSurface, deserializeFaceSurface } from '@/texture/uv_matrix/face_surface_description.js';

/** Undoable clip of one solid brush by a world-space plane. */
export class CommandSolidBrushClip implements UndoCommand {
  private readonly model: SolidModel;
  private readonly brushId: string;
  private readonly worldPlane: THREE.Plane;
  private readonly keepFront: boolean;
  private previousBrush: SolidBrush | null;
  private previousDefaultSurface: FaceSurfaceDescriptionSerialized | null;
  private previousFaceSurfaces: (FaceSurfaceDescriptionSerialized | undefined)[] | null;
  private executed: boolean;

  /**
   * Creates a solid brush clip command.
   *
   * @param model Owning solid model.
   * @param brushId Brush instance id.
   * @param worldPlane World-space clip plane.
   * @param keepFront Whether to keep the Three.js front half-space.
   */
  constructor(model: SolidModel, brushId: string, worldPlane: THREE.Plane, keepFront: boolean) {
    this.model = model;
    this.brushId = brushId;
    this.worldPlane = worldPlane.clone();
    this.keepFront = keepFront;
    this.previousBrush = null;
    this.previousDefaultSurface = null;
    this.previousFaceSurfaces = null;
    this.executed = false;
  }

  /** Applies the clip to the brush and rebuilds the solid model. */
  execute(): void {
    if (this.executed) return;
    const instance = this.model.findBrush(this.brushId);
    if (!instance) return;
    const localPlane = this.worldPlaneToLocal(instance, this.worldPlane);
    const clipped = SolidBrushPlaneClip.clipKeepThreeHalfSpace(instance.brush, localPlane, this.keepFront);
    if (!clipped) return;
    this.previousBrush = instance.brush.clone();
    const surfaceSnapshot = captureInstanceFaceSurfaces(instance);
    this.previousDefaultSurface = surfaceSnapshot.defaultSurface;
    this.previousFaceSurfaces = surfaceSnapshot.faceSurfaces;
    const sourceSurfaces = this.materializeSourceSurfaces(instance);
    this.applyBrushGeometry(instance, clipped);
    applyTransferredSurfacesToInstance(
      instance,
      this.previousBrush,
      sourceSurfaces.defaultSurface,
      sourceSurfaces.faceSurfaces,
    );
    this.model.markDirty();
    this.model.rebuild(true);
    this.executed = true;
  }

  /** Restores the previous brush geometry and UV surfaces. */
  undo(): void {
    if (!this.executed || !this.previousBrush) return;
    const instance = this.model.findBrush(this.brushId);
    if (!instance) return;
    this.applyBrushGeometry(instance, this.previousBrush);
    instance.restoreFaceSurfaces(this.previousDefaultSurface ?? undefined, this.previousFaceSurfaces ?? undefined);
    this.previousBrush = null;
    this.previousDefaultSurface = null;
    this.previousFaceSurfaces = null;
    this.model.markDirty();
    this.model.rebuild(true);
    this.executed = false;
  }

  /**
   * Returns whether the last execute produced a clipped brush.
   *
   * @returns True when geometry changed.
   */
  didClip(): boolean {
    return this.executed;
  }

  /**
   * Builds live FaceSurfaceDescription arrays from the instance for transfer.
   *
   * @param instance Source brush instance.
   * @returns Default and per-face surfaces.
   */
  private materializeSourceSurfaces(instance: SolidBrushInstance): {
    defaultSurface: FaceSurfaceDescription;
    faceSurfaces: (FaceSurfaceDescription | undefined)[];
  } {
    const defaultSurface = deserializeFaceSurface(instance.serializeDefaultSurface());
    const faceSurfaces: (FaceSurfaceDescription | undefined)[] = [];
    const faceCount = instance.brush.faces.length;
    for (let index = 0; index < faceCount; index++) {
      faceSurfaces[index] = cloneFaceSurface(instance.getFaceSurface(index));
    }
    return { defaultSurface, faceSurfaces };
  }

  /**
   * Transforms a world plane into brush local space (includes model root).
   *
   * @param instance Brush instance with mesh transform.
   * @param worldPlane World plane.
   * @returns Local Three.js plane.
   */
  private worldPlaneToLocal(instance: SolidBrushInstance, worldPlane: THREE.Plane): THREE.Plane {
    instance.pullTransformFromMesh();
    if (instance.mesh) {
      instance.mesh.updateMatrixWorld(true);
      return worldPlane.clone().applyMatrix4(instance.mesh.matrixWorld.clone().invert());
    }
    return worldPlane.clone().applyMatrix4(instance.getLocalMatrix().invert());
  }

  /**
   * Replaces brush topology with the clipped geometry.
   *
   * @param instance Brush instance.
   * @param brush New local topology.
   */
  private applyBrushGeometry(instance: SolidBrushInstance, brush: SolidBrush): void {
    solidBrushPreviewSwap(instance, brush);
  }
}
