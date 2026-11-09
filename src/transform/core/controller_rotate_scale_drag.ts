import * as THREE from 'three';
import { GizmoAxis } from '@/types/transform_mode.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from './transform_executor.js';
import { TransformConstraint } from './transform_constraint.js';
import { TransformDragSession } from './session_transform_drag.js';
import { TransformProjectionMath } from './transform_projection_math.js';
import { freeScaleAxisFactors } from './free_scale_axis_factors.js';
import { TransformModalAxis } from '@/transform/modal/transform_modal_axis.js';
import { resolveKeyboardAxisOrientation } from '@/transform/modal/transform_modal_axis_orientation.js';
import { transformModalAxisWorldVector } from '@/transform/modal/transform_modal_axis_vector.js';

/** Collaborators a rotate and scale drag reads and drives. */
export interface ControllerRotateScaleDragHost {
  /** Gizmo whose orientation defines handle axes. */
  transformGizmo: GizmoTransform;
  /** Raycaster projecting the pointer onto drag planes. */
  gizmoRaycaster: GizmoRaycaster;
  /** Executor applying absolute rotations and scales. */
  transformExecutor: TransformExecutor;
  /**
   * Returns the current keyboard axis lock.
   *
   * @returns Modal axis, or None without a lock.
   */
  modalAxisRead(): TransformModalAxis;
  /**
   * Re-bakes texture-locked faces after objects moved or scaled.
   *
   * @param objects Changed objects.
   * @param translationLike Whether positions changed.
   * @param scaleLike Whether scales changed.
   */
  rebakeLockedTextures(objects: THREE.Object3D[], translationLike: boolean, scaleLike: boolean): void;
}

/**
 * Drives gizmo rotate and scale handle drags from a pre-drag snapshot: rotation
 * measures angles in the axis plane or around the projected pivot, scale uses
 * pivot-to-pointer distance ratios.
 */
export class ControllerRotateScaleDrag {
  private readonly session: TransformDragSession;
  private readonly host: ControllerRotateScaleDragHost;
  private readonly transformGizmo: GizmoTransform;
  private readonly gizmoRaycaster: GizmoRaycaster;
  private readonly transformExecutor: TransformExecutor;
  private readonly scratchKeyboardOrientation: THREE.Quaternion;

  /**
   * Creates a rotate and scale drag controller.
   *
   * @param session Shared drag session.
   * @param host Gizmo, raycaster, executor, modal lock and texture rebake
   *   access.
   */
  constructor(session: TransformDragSession, host: ControllerRotateScaleDragHost) {
    this.session = session;
    this.host = host;
    this.transformGizmo = host.transformGizmo;
    this.gizmoRaycaster = host.gizmoRaycaster;
    this.transformExecutor = host.transformExecutor;
    this.scratchKeyboardOrientation = new THREE.Quaternion();
  }

  /**
   * Stores the initial direction or screen position for rotation.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param pivot The transform pivot.
   */
  captureRotateStart(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent, pivot: THREE.Vector3): void {
    this.session.initialScreenPosition = TransformProjectionMath.getScreenPosition(pickElement, event);
    this.session.frozenRotationAxisWorld = this.resolveActiveRotationAxisWorld();
    this.session.initialScreenAngleRadians = this.computeSignedScreenAngleAroundPivot(
      camera,
      pickElement,
      event,
      pivot,
    );
    this.session.useScreenSpaceRotation = true;
    this.session.initialRotationDirection = null;
    const planeAxis = this.rotationPlaneAxisResolve(camera);
    if (planeAxis) {
      this.rotationStartDirectionCapture(camera, pickElement, event, pivot, planeAxis);
    }
  }

  /**
   * Returns the frozen rotation axis when the drag can measure angles in the
   * axis plane: a single handle axis that is not edge-on to the camera.
   *
   * @param camera The viewport camera.
   * @returns Axis for plane rotation, or null to rotate in screen space.
   */
  private rotationPlaneAxisResolve(camera: THREE.Camera): THREE.Vector3 | null {
    if (!this.session.activeAxis || this.session.activeAxis === GizmoAxis.VIEW) {
      return null;
    }
    const axis = this.session.frozenRotationAxisWorld;
    if (!axis || TransformProjectionMath.isAxisEdgeOn(camera, axis)) {
      return null;
    }
    return axis;
  }

  /**
   * Stores the rotation plane and the start direction from the pivot to the
   * pointer hit on it, switching the drag to plane rotation when the hit is
   * usable.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param pivot The transform pivot.
   * @param axis Rotation axis the plane is normal to.
   */
  private rotationStartDirectionCapture(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    pivot: THREE.Vector3,
    axis: THREE.Vector3,
  ): void {
    this.session.rotationPlane.setFromNormalAndCoplanarPoint(axis, pivot);
    const hit = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, this.session.rotationPlane);
    if (!hit) {
      return;
    }
    const direction = hit.sub(pivot);
    if (direction.lengthSq() < 1e-8) {
      return;
    }
    this.session.useScreenSpaceRotation = false;
    this.session.initialRotationDirection = direction.normalize();
  }

  /**
   * Stores the pivot-to-mouse radial distance for Shape Editor scale ratios.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param pivot The transform pivot.
   */
  captureScaleStart(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent, pivot: THREE.Vector3): void {
    const plane = TransformProjectionMath.buildCameraPlane(camera, pivot);
    const hit = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
    this.session.initialMousePosition = hit;
    if (!hit) {
      this.session.initialDistanceAlongAxis = 0;
      return;
    }
    this.session.initialDistanceAlongAxis = hit.distanceTo(pivot);
  }

  /**
   * Applies rotation from drag start using axis-plane angle or screen space.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param objects The meshes to rotate.
   */
  handleRotateMove(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent, objects: THREE.Object3D[]): void {
    if (!this.session.activeAxis) return;
    const axis = this.resolveActiveRotationAxisWorld();
    if (!axis) return;
    const angle = this.computeRotationAngle(camera, pickElement, event, axis);
    this.session.lastPointerRotationAngle = angle;
    this.session.dragRotationAngle = angle;
    this.transformExecutor.applyAbsoluteRotation(
      objects,
      this.session.initialPositions,
      this.session.initialQuaternions,
      this.session.dragPivot,
      axis,
      angle,
    );
    this.host.rebakeLockedTextures(objects, true, false);
  }

  /**
   * Resolves the world rotation axis from modal lock or the active handle.
   *
   * @returns Unit world axis, or null.
   */
  private resolveActiveRotationAxisWorld(): THREE.Vector3 | null {
    const modalAxis = this.resolveModalRotationAxisWorld();
    if (modalAxis) {
      return modalAxis;
    }
    return this.resolveHandleRotationAxisWorld();
  }

  /**
   * Resolves the world axis for a keyboard X/Y/Z rotation or scale lock.
   *
   * @returns Unit world axis, or null when no keyboard lock is active.
   */
  private resolveModalRotationAxisWorld(): THREE.Vector3 | null {
    const modalAxis = this.host.modalAxisRead();
    if (modalAxis === TransformModalAxis.None) {
      return null;
    }
    const orientation = resolveKeyboardAxisOrientation(
      this.transformExecutor.getGridSnap(),
      this.transformGizmo.getOrientation(),
      this.scratchKeyboardOrientation,
    );
    return transformModalAxisWorldVector(modalAxis, orientation);
  }

  /**
   * Resolves the world axis for the active handle, including a frozen drag
   * axis.
   *
   * @returns Unit world axis, or null when no handle axis is active.
   */
  private resolveHandleRotationAxisWorld(): THREE.Vector3 | null {
    if (this.session.frozenRotationAxisWorld && this.session.dragActive) {
      return this.session.frozenRotationAxisWorld.clone();
    }
    if (!this.session.activeAxis) {
      return null;
    }
    if (this.session.activeAxis === GizmoAxis.VIEW) {
      return this.resolveViewRotationAxisWorld();
    }
    return TransformProjectionMath.axisToWorldVector(this.session.activeAxis, this.transformGizmo.getOrientation());
  }

  /**
   * Resolves the camera-forward axis used for view-plane rotation.
   *
   * @returns Unit camera forward.
   */
  private resolveViewRotationAxisWorld(): THREE.Vector3 {
    const camera = this.session.dragCamera ?? new THREE.PerspectiveCamera();
    return TransformProjectionMath.getCameraForwardDirection(camera);
  }

  /**
   * Computes the signed rotation angle for the current pointer sample.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param axis The rotation axis.
   * @returns Signed rotation angle in radians (pre-snap).
   */
  private computeRotationAngle(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    axis: THREE.Vector3,
  ): number {
    if (this.session.useScreenSpaceRotation || !this.session.initialRotationDirection) {
      return this.computePivotOrbitScreenRotationAngle(camera, pickElement, event);
    }
    const hit = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, this.session.rotationPlane);
    if (!hit) {
      return this.computePivotOrbitScreenRotationAngle(camera, pickElement, event);
    }
    const currentDirection = hit.clone().sub(this.session.dragPivot);
    if (currentDirection.lengthSq() < 1e-8) {
      return this.session.dragRotationAngle;
    }
    return TransformConstraint.computeRotationAngle(this.session.initialRotationDirection, currentDirection, axis);
  }

  /**
   * Shape Editor / Blender free-rotate: signed angle around the projected pivot
   * between the start mouse vector and the current mouse vector (not raw screen
   * deltas).
   *
   * @param camera Active camera for projecting the world pivot.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @returns Signed rotation angle in radians from drag start.
   */
  private computePivotOrbitScreenRotationAngle(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
  ): number {
    const currentAngle = this.computeSignedScreenAngleAroundPivot(camera, pickElement, event, this.session.dragPivot);
    return this.wrapSignedAngleRadians(currentAngle - this.session.initialScreenAngleRadians);
  }

  /**
   * Signed angle of the mouse relative to the projected pivot (Shape Editor
   * Vector2.SignedAngle against up).
   *
   * @param camera Active camera.
   * @param pickElement DOM pick target.
   * @param event Pointer event.
   * @param worldPivot World-space pivot.
   * @returns Signed angle in radians.
   */
  private computeSignedScreenAngleAroundPivot(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    worldPivot: THREE.Vector3,
  ): number {
    const pivotScreen = TransformProjectionMath.projectWorldPointToNormalizedScreen(camera, pickElement, worldPivot);
    const mouseScreen = TransformProjectionMath.getScreenPosition(pickElement, event);
    const offsetX = mouseScreen.x - pivotScreen.x;
    const offsetY = mouseScreen.y - pivotScreen.y;
    if (offsetX * offsetX + offsetY * offsetY < 1e-12) {
      return this.session.initialScreenAngleRadians;
    }
    return Math.atan2(offsetX, -offsetY);
  }

  /**
   * Wraps an angle into (-π, π] for stable DeltaAngle-style updates.
   *
   * @param angleRadians Angle in radians.
   * @returns Wrapped angle.
   */
  private wrapSignedAngleRadians(angleRadians: number): number {
    let wrapped = angleRadians;
    while (wrapped > Math.PI) {
      wrapped -= Math.PI * 2;
    }
    while (wrapped <= -Math.PI) {
      wrapped += Math.PI * 2;
    }
    return wrapped;
  }

  /**
   * Applies scale from drag start using Shape Editor radial distance ratios.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param objects The meshes to scale.
   */
  handleScaleMove(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent, objects: THREE.Object3D[]): void {
    const plane = TransformProjectionMath.buildCameraPlane(camera, this.session.dragPivot);
    const hit = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
    if (!hit) {
      return;
    }
    const factor = this.computeRadialScaleFactorFromHit(hit);
    this.session.lastPointerScaleFactor = factor;
    this.session.dragScaleFactor = factor;
    if (this.shouldApplyUniformScale()) {
      this.applyUniformScaleFromFactor(objects, factor);
      return;
    }
    this.applyAxisConstrainedScaleFromFactor(objects, factor);
  }

  /**
   * Computes the Shape Editor scale factor from pivot-to-mouse radial distance.
   *
   * @param hit Camera-plane mouse hit in world space.
   * @returns Scale factor relative to drag start.
   */
  private computeRadialScaleFactorFromHit(hit: THREE.Vector3): number {
    const currentDistance = hit.distanceTo(this.session.dragPivot);
    return TransformConstraint.computeScaleFactor(this.session.initialDistanceAlongAxis, currentDistance);
  }

  /**
   * Returns true for free uniform scale (single-use S without axis lock, VIEW).
   *
   * @returns True when all local scale axes should receive the radial factor.
   */
  private shouldApplyUniformScale(): boolean {
    if (this.host.modalAxisRead() !== TransformModalAxis.None) {
      return false;
    }
    if (this.session.isSingleUseDrag) {
      return true;
    }
    if (!this.session.activeAxis || this.session.activeAxis === GizmoAxis.VIEW) {
      return true;
    }
    return false;
  }

  /**
   * Applies free ScaleAroundPivot scale for free S / VIEW center cube (uniform
   * in 3D; planar axes only in orthographic 2D).
   *
   * @param objects Drag targets.
   * @param factor Radial distance ratio.
   */
  private applyUniformScaleFromFactor(objects: THREE.Object3D[], factor: number): void {
    const axisFactors = freeScaleAxisFactors(factor, this.session.dragCamera, this.session.isSingleUseDrag);
    this.transformExecutor.applyAbsoluteFreeScale(
      objects,
      this.session.initialPositions,
      this.session.initialScales,
      this.session.dragPivot,
      axisFactors,
    );
    this.host.rebakeLockedTextures(objects, false, true);
  }

  /**
   * Applies radial-factor scale on one gizmo axis (ScaleWidget X/Y style).
   *
   * @param objects Drag targets.
   * @param factor Radial distance ratio.
   */
  private applyAxisConstrainedScaleFromFactor(objects: THREE.Object3D[], factor: number): void {
    const axis = this.resolveActiveRotationAxisWorld();
    if (!axis) {
      return;
    }
    const scaleAxis = this.resolveActiveScaleGizmoAxis();
    if (!scaleAxis) {
      return;
    }
    this.transformExecutor.applyAbsoluteScale(
      objects,
      this.session.initialPositions,
      this.session.initialScales,
      this.session.dragPivot,
      axis,
      factor,
      scaleAxis,
    );
    this.host.rebakeLockedTextures(objects, false, true);
  }

  /**
   * Resolves the gizmo axis enum used for scale after optional modal lock.
   *
   * @returns Single-axis gizmo axis, or null.
   */
  private resolveActiveScaleGizmoAxis(): GizmoAxis | null {
    const modalAxis = this.host.modalAxisRead();
    if (modalAxis === TransformModalAxis.X) return GizmoAxis.X;
    if (modalAxis === TransformModalAxis.Y) return GizmoAxis.Y;
    if (modalAxis === TransformModalAxis.Z) return GizmoAxis.Z;
    if (!this.session.activeAxis) return null;
    if (
      this.session.activeAxis === GizmoAxis.X ||
      this.session.activeAxis === GizmoAxis.Y ||
      this.session.activeAxis === GizmoAxis.Z
    ) {
      return this.session.activeAxis;
    }
    return null;
  }
}
