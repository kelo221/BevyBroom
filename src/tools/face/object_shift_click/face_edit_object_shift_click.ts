import type * as THREE from 'three';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import type { FacePickResult } from '@/selection/face/raycaster_face_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { createSyntheticPointerDown } from '@/utils/synthetic_pointer_event.js';

/** Camera and pick element of the view under a client point. */
export interface FaceEditObjectShiftClickViewport {
  readonly camera: THREE.Camera;
  readonly pickElement: HTMLElement;
}

/** Editor parts the object tool Shift+click face editing reads and drives. */
export interface FaceEditObjectShiftClickDependencies {
  /**
   * Returns the face mode coordinator.
   *
   * @returns Coordinator, or null before face editing exists.
   */
  readonly faceModeCoordinatorRead: () => CoordinatorFaceMode | null;
  /**
   * Returns the meshes under a client point, nearest first.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Picked meshes, empty when nothing is there.
   */
  readonly pickObjectStackAtClientPoint: (clientX: number, clientY: number) => THREE.Mesh[];
  /**
   * Returns the camera and pick element of the view under a client point.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns View, or null when the point is over no view.
   */
  readonly viewportAtClientPointResolve: (clientX: number, clientY: number) => FaceEditObjectShiftClickViewport | null;
  /**
   * Returns whether the object select tool owns the viewport clicks.
   *
   * @returns True when a Shift+click may switch to the Face tool.
   */
  readonly isShiftClickFaceEditAllowed: () => boolean;
  /** Activates the Face tool exactly as its tools palette button does. */
  readonly faceToolActivate: () => void;
}

/**
 * Turns an object tool Shift+click on a brush face into face editing: the Face
 * tool becomes active, the Face Edit Sheet opens and exactly the clicked face
 * (or the displaced face whose surface was hit) becomes the face selection.
 * Clicks whose nearest object is no brush, and clicks over empty space, are
 * left to object selection.
 */
export class FaceEditObjectShiftClick {
  private readonly dependencies: FaceEditObjectShiftClickDependencies;

  /**
   * Creates the Shift+click face editing.
   *
   * @param dependencies Picking, face mode and tool switching it uses.
   */
  constructor(dependencies: FaceEditObjectShiftClickDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Handles an object tool Shift+click release.
   *
   * @param clientX Release client X.
   * @param clientY Release client Y.
   * @returns True when the Face tool took the click and selected the face.
   */
  clickApply(clientX: number, clientY: number): boolean {
    const coordinator = this.dependencies.faceModeCoordinatorRead();
    if (!coordinator || !this.dependencies.isShiftClickFaceEditAllowed()) {
      return false;
    }
    if (!this.nearestObjectBrushOrNoneIs(clientX, clientY)) {
      return false;
    }
    const pick = this.facePickAtClientPoint(coordinator, clientX, clientY);
    return pick !== null && this.faceToolOpenWithFace(coordinator, pick);
  }

  /**
   * Returns whether the nearest object under a client point belongs to a solid
   * model, or no object is there (displacement surfaces are no objects).
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns False when a light, entity or other mesh is nearest.
   */
  private nearestObjectBrushOrNoneIs(clientX: number, clientY: number): boolean {
    const nearestObject = this.dependencies.pickObjectStackAtClientPoint(clientX, clientY)[0];
    return nearestObject === undefined || SolidModel.fromObject(nearestObject) !== null;
  }

  /**
   * Picks the brush face under a client point with the face tool's own pick.
   *
   * @param coordinator Face mode coordinator.
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Face pick, or null when no brush face is there.
   */
  private facePickAtClientPoint(
    coordinator: CoordinatorFaceMode,
    clientX: number,
    clientY: number,
  ): FacePickResult | null {
    const viewport = this.dependencies.viewportAtClientPointResolve(clientX, clientY);
    if (!viewport) {
      return null;
    }
    coordinator.updateFaceSelectionMeshes();
    const event = createSyntheticPointerDown(clientX, clientY);
    return coordinator.getFaceExtrusionController().pickFaceUnderPointer(event, viewport.camera, viewport.pickElement);
  }

  /**
   * Activates the Face tool and makes the picked face the only selected face.
   *
   * @param coordinator Face mode coordinator.
   * @param pick Face to select.
   * @returns True when face mode became active and the face was selected.
   */
  private faceToolOpenWithFace(coordinator: CoordinatorFaceMode, pick: FacePickResult): boolean {
    this.dependencies.faceToolActivate();
    const controller = coordinator.getFaceExtrusionController();
    if (controller.getSelectionMode() !== SelectionMode.FACE) {
      return false;
    }
    controller.applyPlainFaceClickSelection(pick);
    return true;
  }
}
