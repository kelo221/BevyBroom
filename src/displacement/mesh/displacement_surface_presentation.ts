import * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { disposeBrushPreviewResources } from '@/solid/model/solid_model_mesh_disposal.js';
import { createContentMaterial } from '@/materials/factory_content_material.js';
import { rebuildSolidResultMaterials } from '@/texture/material/builder_surface_material.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import { Theme } from '@/theme.js';
import { displacementFaceAttachedIs } from '@/displacement/model/displacement_face_eligibility.js';
import { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import { DisplacementMeshBuilder } from './displacement_mesh_builder.js';
import { DisplacementSurfaceChangeNotifier } from './displacement_surface_change_notifier.js';
import {
  DISPLACEMENT_SURFACE_MESH_USERDATA_KEY,
  displacementSurfaceMeshFind,
  displacementSurfaceMeshIdentityRead,
  displacementSurfaceMeshNameBuild,
  displacementSurfaceMeshesUnder,
  type DisplacementSurfaceMeshIdentity,
} from './displacement_surface_mesh_keys.js';

/**
 * Keeps one displacement surface mesh per displaced brush face as a direct
 * child of the solid model root, rebuilt from the brush face whenever the brush
 * is remeshed so moves, texture edits and sculpting follow the brush.
 */
export class DisplacementSurfacePresentation {
  /**
   * Rebuilds the displacement surface meshes of one brush, removes meshes of
   * faces that are no longer displaced and notifies displacement surface change
   * listeners when any mesh was rebuilt or removed.
   *
   * @param brushId Brush id the meshes belong to.
   * @param brush Brush instance, or undefined when it no longer exists.
   * @param solidRoot Solid model root owning the meshes, or undefined.
   */
  brushRefresh(brushId: string, brush: SolidBrushInstance | undefined, solidRoot: THREE.Object3D | undefined): void {
    if (!solidRoot) {
      return;
    }
    const attached = brush
      ? brush.faceDisplacementIndices().filter((index) => displacementFaceAttachedIs(brush, index))
      : [];
    const removedCount = this.staleMeshesRemove(
      solidRoot,
      (identity) => identity.brushId === brushId && !attached.includes(identity.surfaceIndex),
    );
    if (brush) {
      attached.forEach((surfaceIndex) => this.faceMeshUpsert(brush, surfaceIndex, solidRoot));
    }
    if (removedCount > 0 || attached.length > 0) {
      DisplacementSurfaceChangeNotifier.notify(solidRoot);
    }
  }

  /**
   * Removes the displacement surface meshes of brushes outside a set and
   * notifies displacement surface change listeners when any mesh was removed.
   *
   * @param brushIds Brush ids whose meshes stay.
   * @param solidRoot Solid model root owning the meshes, or undefined.
   */
  pruneToBrushIds(brushIds: ReadonlySet<string>, solidRoot: THREE.Object3D | undefined): void {
    if (!solidRoot) {
      return;
    }
    if (this.staleMeshesRemove(solidRoot, (identity) => !brushIds.has(identity.brushId)) > 0) {
      DisplacementSurfaceChangeNotifier.notify(solidRoot);
    }
  }

  /**
   * Removes and disposes every displacement surface mesh matching a test.
   *
   * @param solidRoot Solid model root.
   * @param isStale Returns true for identities whose mesh must go.
   * @returns Number of removed meshes.
   */
  private staleMeshesRemove(
    solidRoot: THREE.Object3D,
    isStale: (identity: DisplacementSurfaceMeshIdentity) => boolean,
  ): number {
    let removedCount = 0;
    for (const mesh of displacementSurfaceMeshesUnder(solidRoot)) {
      const identity = displacementSurfaceMeshIdentityRead(mesh);
      if (!identity || !isStale(identity)) {
        continue;
      }
      mesh.removeFromParent();
      disposeBrushPreviewResources(mesh);
      removedCount += 1;
    }
    return removedCount;
  }

  /**
   * Creates or rebuilds the displacement surface mesh of one face.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Displaced face index.
   * @param solidRoot Solid model root.
   */
  private faceMeshUpsert(brush: SolidBrushInstance, surfaceIndex: number, solidRoot: THREE.Object3D): void {
    const displacement = brush.faceDisplacementRead(surfaceIndex);
    const placement = displacement
      ? DisplacementSurfacePlacement.forModelSpace(brush, surfaceIndex, displacement)
      : null;
    if (!displacement || !placement) {
      return;
    }
    const surface = brush.getFaceSurface(surfaceIndex);
    const mesh = this.faceMeshFindOrCreate({ brushId: brush.id, surfaceIndex }, solidRoot);
    mesh.geometry.dispose();
    mesh.geometry = DisplacementMeshBuilder.build(placement, displacement, surface);
    rebuildSolidResultMaterials(mesh, [
      { triangleIndices: this.allTriangleIndices(mesh), textureId: surface.textureId },
    ]);
  }

  /**
   * Finds the mesh of one displaced face or creates it under the solid root.
   *
   * @param identity Brush face identity.
   * @param solidRoot Solid model root.
   * @returns Displacement surface mesh.
   */
  private faceMeshFindOrCreate(identity: DisplacementSurfaceMeshIdentity, solidRoot: THREE.Object3D): THREE.Mesh {
    const existing = displacementSurfaceMeshFind(solidRoot, identity.brushId, identity.surfaceIndex);
    if (existing) {
      return existing;
    }
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), createContentMaterial(Theme.boxColor));
    mesh.name = displacementSurfaceMeshNameBuild(identity);
    mesh.userData[DISPLACEMENT_SURFACE_MESH_USERDATA_KEY] = { ...identity };
    solidRoot.add(mesh);
    return mesh;
  }

  /**
   * Lists every triangle index of a mesh.
   *
   * @param mesh Mesh to enumerate.
   * @returns Indices 0 to triangle count minus one.
   */
  private allTriangleIndices(mesh: THREE.Mesh): number[] {
    return Array.from({ length: getTriangleCount(mesh.geometry) }, (_unused, index) => index);
  }
}
