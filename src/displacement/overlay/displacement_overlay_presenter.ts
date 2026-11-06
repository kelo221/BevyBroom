import * as THREE from 'three';
import { isSolidModelObject } from '@/solid/model/solid_model_keys.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { displacementSurfaceMeshesUnder } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DisplacementSurfaceChangeNotifier } from '@/displacement/mesh/displacement_surface_change_notifier.js';
import { DisplacementOverlayMaterials } from './displacement_overlay_materials.js';
import { DisplacementOverlaySurface, type DisplacementOverlayVisibility } from './displacement_overlay_surface.js';
import { displacementOverlayHelperMark } from './displacement_overlay_helper_flags.js';

/** Services the displacement overlay presenter works with. */
export interface DisplacementOverlayPresenterDeps {
  /**
   * Editor-only helper parent outside the world hierarchy receiving the overlay
   * group.
   */
  readonly helperParent: THREE.Object3D;
  /** Returns the editor world root whose solid models carry displacements. */
  readonly worldRootRead: () => THREE.Object3D;
  /** Returns whether face selection mode is active. */
  readonly isFaceModeActive: () => boolean;
}

/**
 * Keeps one grid wireframe and one alpha tint per displacement surface mesh in
 * an editor-only helper group outside the world, so exports and picking never
 * see them. Overlays rebuild when surfaces change and follow the surfaces'
 * world transforms every frame. Grids show in face mode while the Grid mask is
 * on; alpha tints show in face mode while Paint Alpha is the active tool.
 */
export class DisplacementOverlayPresenter {
  private readonly overlayGroup = new THREE.Group();
  private readonly materials = new DisplacementOverlayMaterials();
  private readonly overlays = new Map<THREE.Mesh, DisplacementOverlaySurface>();
  private readonly trackedSolidRoots = new Set<THREE.Object3D>();
  private readonly surfaceChangeUnsubscribe: () => void;
  private isSyncPending = true;

  /**
   * Creates the overlay group, tracks the solid models already in the world and
   * listens for displacement surface changes.
   *
   * @param deps Helper parent, world root and face mode services.
   */
  constructor(private readonly deps: DisplacementOverlayPresenterDeps) {
    this.overlayGroup.name = 'displacement_overlay_group';
    displacementOverlayHelperMark(this.overlayGroup);
    deps.helperParent.add(this.overlayGroup);
    this.solidRootsInWorldTrack();
    this.surfaceChangeUnsubscribe = DisplacementSurfaceChangeNotifier.listenerAdd((solidRoot) =>
      this.solidRootChangedNote(solidRoot),
    );
  }

  /**
   * Rebuilds overlays of changed surfaces when needed, then places and shows
   * every overlay for this frame.
   */
  frameUpdate(): void {
    if (this.isSyncPending) {
      this.isSyncPending = false;
      this.overlaysSync();
    }
    const visibility = this.visibilityRead();
    const worldRoot = this.deps.worldRootRead();
    this.overlays.forEach((overlay) => overlay.follow(visibility, worldRoot));
  }

  /**
   * Returns the helper group holding every overlay.
   *
   * @returns Overlay group.
   */
  overlayGroupRead(): THREE.Group {
    return this.overlayGroup;
  }

  /**
   * Returns the overlays of one displacement surface mesh.
   *
   * @param surfaceMesh Displacement surface mesh.
   * @returns Overlays, or null when the mesh has none.
   */
  overlayRead(surfaceMesh: THREE.Mesh): DisplacementOverlaySurface | null {
    return this.overlays.get(surfaceMesh) ?? null;
  }

  /**
   * Returns how many surface meshes carry overlays.
   *
   * @returns Overlay count.
   */
  overlayCountRead(): number {
    return this.overlays.size;
  }

  /** Stops listening, removes the overlay group and releases every overlay. */
  dispose(): void {
    this.surfaceChangeUnsubscribe();
    this.overlays.forEach((overlay) => overlay.dispose());
    this.overlays.clear();
    this.trackedSolidRoots.clear();
    this.overlayGroup.removeFromParent();
    this.materials.dispose();
  }

  /** Tracks every solid model root currently under the world root. */
  private solidRootsInWorldTrack(): void {
    this.deps.worldRootRead().traverse((object) => {
      if (isSolidModelObject(object)) {
        this.trackedSolidRoots.add(object);
      }
    });
  }

  /**
   * Tracks a solid model root whose displacement surfaces changed and schedules
   * an overlay sync.
   *
   * @param solidRoot Changed solid model root.
   */
  private solidRootChangedNote(solidRoot: THREE.Object3D): void {
    this.trackedSolidRoots.add(solidRoot);
    this.isSyncPending = true;
  }

  /**
   * Reads which overlay kinds are wanted from face mode, the Grid mask and the
   * active displacement tool.
   *
   * @returns Overlay visibility for this frame.
   */
  private visibilityRead(): DisplacementOverlayVisibility {
    const faceModeActive = this.deps.isFaceModeActive();
    return {
      grid: faceModeActive && getStateFaceEditSession().gridMaskRead(),
      alphaTint: faceModeActive && getStateDisplacementSculpt().settingsRead().activeTool === 'paint_alpha',
    };
  }

  /**
   * Builds overlays for new or rebuilt surface meshes, drops overlays of
   * removed meshes and stops tracking solid roots without displacement
   * surfaces.
   */
  private overlaysSync(): void {
    const liveSurfaceMeshes = new Set<THREE.Mesh>();
    this.trackedSolidRoots.forEach((solidRoot) => {
      const surfaceMeshes = displacementSurfaceMeshesUnder(solidRoot);
      if (surfaceMeshes.length === 0) {
        this.trackedSolidRoots.delete(solidRoot);
      }
      surfaceMeshes.forEach((surfaceMesh) => liveSurfaceMeshes.add(surfaceMesh));
    });
    this.overlaysOfRemovedMeshesDrop(liveSurfaceMeshes);
    liveSurfaceMeshes.forEach((surfaceMesh) => this.overlayUpsert(surfaceMesh));
  }

  /**
   * Releases the overlays of surface meshes that no longer exist.
   *
   * @param liveSurfaceMeshes Surface meshes that still exist.
   */
  private overlaysOfRemovedMeshesDrop(liveSurfaceMeshes: ReadonlySet<THREE.Mesh>): void {
    this.overlays.forEach((overlay, surfaceMesh) => {
      if (!liveSurfaceMeshes.has(surfaceMesh)) {
        overlay.dispose();
        this.overlays.delete(surfaceMesh);
      }
    });
  }

  /**
   * Builds the overlays of a surface mesh unless they match its geometry.
   *
   * @param surfaceMesh Displacement surface mesh.
   */
  private overlayUpsert(surfaceMesh: THREE.Mesh): void {
    const existing = this.overlays.get(surfaceMesh);
    if (existing?.isCurrent()) {
      return;
    }
    existing?.dispose();
    this.overlays.set(surfaceMesh, new DisplacementOverlaySurface(surfaceMesh, this.materials, this.overlayGroup));
  }
}
