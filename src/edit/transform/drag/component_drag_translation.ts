import * as THREE from 'three';
import { GizmoAxis } from '@/types/transform_mode.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import { TransformProjectionMath } from '@/transform/core/transform_projection_math.js';
import { TransformModalAxis } from '@/transform/modal/transform_modal_axis.js';
import { transformModalAxisWorldVector } from '@/transform/modal/transform_modal_axis_vector.js';
import type { ComponentTransformVertex } from '@/edit/transform/component_transform_vertex.js';
import { componentTransformLocalToWorld } from '@/edit/transform/component_transform_vertex.js';
import {
  componentDragPointerRayBuild,
  componentDragSurfaceHit,
  type ComponentDragSurface,
} from './component_drag_surface.js';
import { componentDragSurfaceResolve } from './component_drag_surface_resolve.js';
import { componentDragDeltaSnap } from './component_drag_grid_snap.js';

/** Axis and plane locks active during one pointer sample. */
export interface ComponentDragTranslationLocks {
  /** Keyboard axis lock. */
  readonly modalAxis: TransformModalAxis;
  /** Orientation of the keyboard axis lock. */
  readonly modalOrientation: THREE.Quaternion;
  /** Picked gizmo handle. */
  readonly handleAxis: GizmoAxis;
  /** Orientation of the gizmo handle. */
  readonly handleOrientation: THREE.Quaternion;
}

/** Pointer samples of one translation, in client pixels. */
export interface ComponentDragTranslationPointer {
  /** Viewport camera. */
  readonly camera: THREE.Camera;
  /** Element the viewport draws into. */
  readonly pickElement: HTMLElement;
  /** Client X of the press that started the drag. */
  readonly startClientX: number;
  /** Client Y of the press that started the drag. */
  readonly startClientY: number;
  /** Current client X. */
  readonly clientX: number;
  /** Current client Y. */
  readonly clientY: number;
}

/** Gizmo plane handles and the world axis each one keeps fixed. */
const COMPONENT_DRAG_PLANE_HANDLE_NORMALS: ReadonlyMap<GizmoAxis, GizmoAxis> = new Map([
  [GizmoAxis.XY_PLANE, GizmoAxis.Z],
  [GizmoAxis.YZ_PLANE, GizmoAxis.X],
  [GizmoAxis.XZ_PLANE, GizmoAxis.Y],
]);

/**
 * Turns pointer motion into a component translation that follows the pointer on
 * a sensible surface (axis line, face normal or grid plane) and lands the
 * dragged vertex nearest the press on the grid.
 */
export class ComponentDragTranslation {
  private readonly gridSnap: GridSnap;
  private readonly pivot = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  private faceNormal: THREE.Vector3 | null = null;
  private anchorCaptured = false;

  /**
   * Creates the translation solver.
   *
   * @param gridSnap Shared grid snap.
   */
  constructor(gridSnap: GridSnap) {
    this.gridSnap = gridSnap;
  }

  /**
   * Starts a translation of components around a pivot.
   *
   * @param pivot World pivot of the dragged components.
   * @param faceNormal Unit world normal when only faces are dragged, or null.
   */
  begin(pivot: THREE.Vector3, faceNormal: THREE.Vector3 | null): void {
    this.pivot.copy(pivot);
    this.faceNormal = faceNormal ? faceNormal.clone() : null;
    this.anchorCaptured = false;
  }

  /**
   * Computes the snapped world delta for one pointer sample.
   *
   * @param pointer Camera, element and pointer positions.
   * @param locks Active locks.
   * @param vertices Dragged vertices, used to pick the anchor on the first
   *   sample.
   * @param constrain Applies the axis or plane lock to a raw delta.
   * @returns Snapped world delta, or null when the pointer misses the surface.
   */
  deltaResolve(
    pointer: ComponentDragTranslationPointer,
    locks: ComponentDragTranslationLocks,
    vertices: readonly ComponentTransformVertex[],
    constrain: (delta: THREE.Vector3) => THREE.Vector3,
  ): THREE.Vector3 | null {
    const surface = this.surfaceResolve(pointer.camera, locks);
    const startHit = this.pointerHit(surface, pointer, pointer.startClientX, pointer.startClientY);
    const currentHit = this.pointerHit(surface, pointer, pointer.clientX, pointer.clientY);
    if (!startHit || !currentHit) {
      return null;
    }
    this.anchorCaptureOnce(vertices, startHit);
    const constrained = constrain(currentHit.sub(startHit));
    return componentDragDeltaSnap(constrained, this.anchor, surface, this.gridSnap);
  }

  /**
   * Picks the drag surface for the current locks.
   *
   * @param camera Viewport camera.
   * @param locks Active locks.
   * @returns Drag surface.
   */
  private surfaceResolve(camera: THREE.Camera, locks: ComponentDragTranslationLocks): ComponentDragSurface {
    return componentDragSurfaceResolve({
      camera,
      pivot: this.pivot,
      lockedLineDirection: this.lockedLineDirection(locks),
      lockedPlaneNormal: this.lockedPlaneNormal(locks),
      faceNormal: this.faceNormal,
      gridUp: this.gridSnap.getPlaneFrame().normal,
    });
  }

  /**
   * Returns the direction of a keyboard axis lock or a gizmo arrow.
   *
   * @param locks Active locks.
   * @returns Unit world direction, or null when no axis is locked.
   */
  private lockedLineDirection(locks: ComponentDragTranslationLocks): THREE.Vector3 | null {
    if (locks.modalAxis !== TransformModalAxis.None) {
      return transformModalAxisWorldVector(locks.modalAxis, locks.modalOrientation);
    }
    const handle = locks.handleAxis;
    if (handle === GizmoAxis.X || handle === GizmoAxis.Y || handle === GizmoAxis.Z) {
      return TransformProjectionMath.axisToWorldVector(handle, locks.handleOrientation);
    }
    return null;
  }

  /**
   * Returns the normal of a gizmo plane handle.
   *
   * @param locks Active locks.
   * @returns Unit world normal, or null when no plane handle is held.
   */
  private lockedPlaneNormal(locks: ComponentDragTranslationLocks): THREE.Vector3 | null {
    if (locks.modalAxis !== TransformModalAxis.None) {
      return null;
    }
    const normalAxis = COMPONENT_DRAG_PLANE_HANDLE_NORMALS.get(locks.handleAxis);
    return normalAxis ? TransformProjectionMath.axisToWorldVector(normalAxis, locks.handleOrientation) : null;
  }

  /**
   * Finds where the pointer at a client position meets the drag surface.
   *
   * @param surface Drag surface.
   * @param pointer Camera and element.
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns World hit, or null when the pointer misses the surface.
   */
  private pointerHit(
    surface: ComponentDragSurface,
    pointer: ComponentDragTranslationPointer,
    clientX: number,
    clientY: number,
  ): THREE.Vector3 | null {
    return componentDragSurfaceHit(
      surface,
      componentDragPointerRayBuild(pointer.camera, pointer.pickElement, clientX, clientY),
    );
  }

  /**
   * Remembers, once per drag, the dragged vertex nearest the press point; that
   * vertex is the one snapping lands on the grid.
   *
   * @param vertices Dragged vertices.
   * @param pressHit World point under the press.
   */
  private anchorCaptureOnce(vertices: readonly ComponentTransformVertex[], pressHit: THREE.Vector3): void {
    if (this.anchorCaptured) {
      return;
    }
    this.anchorCaptured = true;
    let nearestDistance = Number.POSITIVE_INFINITY;
    this.anchor.copy(this.pivot);
    for (const vertex of vertices) {
      const world = componentTransformLocalToWorld(vertex, vertex.initialLocal);
      const distance = world.distanceToSquared(pressHit);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        this.anchor.copy(world);
      }
    }
  }
}
