import type * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { objectInHiddenLayerIs } from '@/layer/model/layer_membership.js';
import { displacementSurfaceMeshIdentityRead } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DisplacementOverlayGrid } from './displacement_overlay_grid.js';
import { DisplacementOverlayAlphaTint } from './displacement_overlay_alpha_tint.js';
import type { DisplacementOverlayMaterials } from './displacement_overlay_materials.js';

/** Which overlay kinds are wanted this frame. */
export interface DisplacementOverlayVisibility {
  /** Whether grid wireframes are drawn. */
  grid: boolean;
  /** Whether alpha tints are drawn. */
  alphaTint: boolean;
}

/**
 * Reads the painted alphas of the brush face a displacement surface mesh shows.
 *
 * @param surfaceMesh Displacement surface mesh.
 * @returns Alphas of the face, or an empty list when the face cannot be found.
 */
function displacementOverlaySurfaceAlphasRead(surfaceMesh: THREE.Mesh): readonly number[] {
  const identity = displacementSurfaceMeshIdentityRead(surfaceMesh);
  const brush = identity ? SolidModel.fromObject(surfaceMesh)?.findBrush(identity.brushId) : undefined;
  return (identity && brush?.faceDisplacementRead(identity.surfaceIndex)?.alphas) ?? [];
}

/**
 * Grid wireframe and alpha tint of one displacement surface mesh, built from
 * one version of the surface geometry.
 */
export class DisplacementOverlaySurface {
  /** Surface mesh the overlays follow. */
  readonly surfaceMesh: THREE.Mesh;
  /** Geometry the overlays were built from. */
  readonly sourceGeometry: THREE.BufferGeometry;
  /** Grid wireframe, or null when the geometry is no displacement grid. */
  readonly grid: DisplacementOverlayGrid | null;
  /** Alpha tint. */
  readonly alphaTint: DisplacementOverlayAlphaTint;

  /**
   * Builds both overlays of a surface mesh and adds them to a parent.
   *
   * @param surfaceMesh Displacement surface mesh to follow.
   * @param materials Shared overlay materials.
   * @param parent Helper group receiving the overlays.
   */
  constructor(surfaceMesh: THREE.Mesh, materials: DisplacementOverlayMaterials, parent: THREE.Object3D) {
    this.surfaceMesh = surfaceMesh;
    this.sourceGeometry = surfaceMesh.geometry;
    this.grid = DisplacementOverlayGrid.create(this.sourceGeometry, materials);
    this.alphaTint = DisplacementOverlayAlphaTint.create(
      this.sourceGeometry,
      displacementOverlaySurfaceAlphasRead(surfaceMesh),
      materials,
    );
    if (this.grid) {
      parent.add(this.grid.root);
    }
    parent.add(this.alphaTint.root);
  }

  /**
   * Returns whether the overlays still match the surface mesh geometry.
   *
   * @returns True while the surface shows the geometry the overlays were built
   *   from.
   */
  isCurrent(): boolean {
    return this.surfaceMesh.geometry === this.sourceGeometry;
  }

  /**
   * Places the overlays on the surface and shows the wanted kinds while the
   * surface itself is shown in the world.
   *
   * @param visibility Overlay kinds wanted this frame.
   * @param worldRoot Editor world root the surface must belong to.
   */
  follow(visibility: DisplacementOverlayVisibility, worldRoot: THREE.Object3D): void {
    const surfaceShown = this.surfaceShownIs(worldRoot);
    if (surfaceShown) {
      this.surfaceMesh.updateWorldMatrix(true, false);
      this.grid?.matrixFollow(this.surfaceMesh.matrixWorld);
      this.alphaTint.matrixFollow(this.surfaceMesh.matrixWorld);
    }
    this.grid?.visibleWrite(surfaceShown && visibility.grid);
    this.alphaTint.visibleWrite(surfaceShown && visibility.alphaTint);
  }

  /** Detaches both overlays and releases their geometries. */
  dispose(): void {
    this.grid?.dispose();
    this.alphaTint.dispose();
  }

  /**
   * Returns whether the surface mesh is attached under the world root with
   * every ancestor visible and no hidden layer.
   *
   * @param worldRoot Editor world root.
   * @returns True when the surface is drawn in the world.
   */
  private surfaceShownIs(worldRoot: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = this.surfaceMesh;
    while (current && current !== worldRoot) {
      if (!current.visible) {
        return false;
      }
      current = current.parent;
    }
    return current === worldRoot && worldRoot.visible && !objectInHiddenLayerIs(this.surfaceMesh);
  }
}
