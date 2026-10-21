import * as THREE from 'three';
import { pointerEventToNdc } from '@/utils/pointer_ndc.js';
import { SceneRaycaster } from '@/selection/object/scene_raycaster.js';
import { computeTriangleNormal } from '@/selection/pick/utils_triangle_geometry.js';
import { isPerspectiveViewportKind, type ViewportKind } from '@/viewports/core/viewport_kind.js';

/** Viewport members an object drag needs (satisfied by 2D and 3D panes). */
export interface ObjectDragViewportSource {
  getCamera(): THREE.Camera;
  getContentElement(): HTMLElement;
  getViewportKind(): ViewportKind;
  getObjectPickStack(event: MouseEvent): THREE.Mesh[];
  getSelectableObjects(): THREE.Mesh[];
}

/** A surface point under the pointer with its world normal facing the camera. */
export interface ObjectDragSurfaceHit {
  /** World hit point. */
  point: THREE.Vector3;
  /** Unit world normal flipped to face the viewer. */
  normal: THREE.Vector3;
  /** Mesh that was hit. */
  mesh: THREE.Mesh;
}

/** Pointer-to-world queries for one viewport pane during an object drag. */
export class ObjectDragViewport {
  private readonly source: ObjectDragViewportSource;
  private readonly surfaceRaycaster = new SceneRaycaster();

  /**
   * Wraps a viewport pane for drag queries.
   *
   * @param source Viewport pane under the drag.
   */
  constructor(source: ObjectDragViewportSource) {
    this.source = source;
  }

  /**
   * Returns the wrapped viewport pane.
   *
   * @returns Viewport source.
   */
  viewportSource(): ObjectDragViewportSource {
    return this.source;
  }

  /**
   * Returns whether the pane uses the perspective 3D camera.
   *
   * @returns True for the perspective pane, false for 2D panes.
   */
  isPerspective(): boolean {
    return isPerspectiveViewportKind(this.source.getViewportKind());
  }

  /**
   * Builds the world pick ray through a client point.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns New ray with a unit direction.
   */
  rayAtClientPoint(clientX: number, clientY: number): THREE.Ray {
    const camera = this.source.getCamera();
    camera.updateMatrixWorld(false);
    const ndc = pointerEventToNdc({ clientX, clientY }, this.source.getContentElement());
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.clone();
  }

  /**
   * Returns the unit camera look direction.
   *
   * @returns New world direction.
   */
  cameraForwardWorld(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.source.getCamera().getWorldDirection(direction);
    return direction.normalize();
  }

  /**
   * Returns the selectable meshes under a client point, nearest first.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Unique world meshes.
   */
  pickStackAtClientPoint(clientX: number, clientY: number): THREE.Mesh[] {
    return this.source.getObjectPickStack(this.syntheticMouseEventCreate(clientX, clientY));
  }

  /**
   * Finds the nearest surface under a client point among candidate meshes.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param candidateMeshes Meshes to test; the pane's selectable meshes when
   *   omitted.
   * @returns Surface hit, or null when nothing is under the pointer.
   */
  surfaceHitAtClientPoint(
    clientX: number,
    clientY: number,
    candidateMeshes?: readonly THREE.Mesh[],
  ): ObjectDragSurfaceHit | null {
    const meshes = candidateMeshes ? [...candidateMeshes] : this.source.getSelectableObjects();
    const camera = this.source.getCamera();
    const event = this.syntheticMouseEventCreate(clientX, clientY);
    const intersections = this.surfaceRaycaster.castIntersections(
      camera,
      this.source.getContentElement(),
      event,
      meshes,
    );
    const nearest = intersections[0];
    if (!nearest || !(nearest.object instanceof THREE.Mesh)) {
      return null;
    }
    return this.surfaceHitFromIntersection(nearest, nearest.object, clientX, clientY);
  }

  /**
   * Converts a raycast intersection into a surface hit facing the viewer.
   *
   * @param intersection Raycast record.
   * @param mesh Mesh that was hit.
   * @param clientX Pointer client X used for the viewer direction.
   * @param clientY Pointer client Y used for the viewer direction.
   * @returns Surface hit.
   */
  private surfaceHitFromIntersection(
    intersection: THREE.Intersection,
    mesh: THREE.Mesh,
    clientX: number,
    clientY: number,
  ): ObjectDragSurfaceHit {
    const normal = this.intersectionWorldNormal(intersection, mesh);
    if (normal.dot(this.rayAtClientPoint(clientX, clientY).direction) > 0) {
      normal.negate();
    }
    return { point: intersection.point.clone(), normal, mesh };
  }

  /**
   * Returns the world-space face normal of an intersection.
   *
   * @param intersection Raycast record.
   * @param mesh Mesh that was hit.
   * @returns New unit normal, or the reversed camera direction when the hit has
   *   no triangle index.
   */
  private intersectionWorldNormal(intersection: THREE.Intersection, mesh: THREE.Mesh): THREE.Vector3 {
    const faceIndex = intersection.faceIndex;
    if (faceIndex === undefined || faceIndex === null) {
      return this.cameraForwardWorld().negate();
    }
    mesh.updateMatrixWorld(false);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    return computeTriangleNormal(mesh.geometry, faceIndex).applyMatrix3(normalMatrix).normalize();
  }

  /**
   * Creates a mouse event carrying only a client position for pick helpers.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Mouse event.
   */
  private syntheticMouseEventCreate(clientX: number, clientY: number): MouseEvent {
    return new MouseEvent('mousemove', { clientX, clientY });
  }
}
