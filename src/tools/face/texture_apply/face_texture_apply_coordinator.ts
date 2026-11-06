import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { getStateTextureStampTool } from '@/tools/texture_stamp/state_texture_stamp_tool.js';
import { FaceAttributeTransferHandler } from '@/tools/face/face_attribute_transfer_handler.js';
import { FaceLiftedSurfaceStore } from './face_lifted_surface_store.js';
import { FaceSecondaryClickGesture, type FaceSecondaryDragHandler } from './face_secondary_click_gesture.js';
import { FaceTextureApplyActions } from './face_texture_apply_actions.js';
import { FaceTextureApplyRouter } from './face_texture_apply_router.js';

/** Services the face texture application runs through. */
export interface FaceTextureApplyCoordinatorDeps {
  readonly commandStack: CommandStack;
  readonly selectionManager: ManagerSelection;
  readonly faceExtrusionController: ControllerFaceExtrusion;
  /** Reads whether Alt is held, for the Alt+click attribute transfer. */
  readonly isAltDown: () => boolean;
  /** Refreshes viewport shading after a surface edit. */
  readonly updateShadingMeshes: () => void;
  /** Pushes rebuilt solid results to the viewports. */
  readonly syncPrimitivesToViewports: () => void;
  /** Shows a status bar message. */
  readonly showStatusMessage: (message: string) => void;
}

/** Viewport a face press happened in. */
export interface FaceTextureApplyViewport {
  /** Camera of the viewport. */
  readonly camera: THREE.Camera;
  /** Element whose rectangle maps client points to the camera view. */
  readonly pickElement: HTMLElement;
}

/**
 * Hammer++ texture application in face mode: Alt+click attribute transfer, the
 * left-click modes of the Face Edit Sheet, the right-click texture apply (Alt
 * for texture + values) and the Apply Current Texture tool.
 */
export class FaceTextureApplyCoordinator {
  private readonly deps: FaceTextureApplyCoordinatorDeps;
  private readonly attributeTransferHandler: FaceAttributeTransferHandler;
  private readonly textureAssignment: ControllerTextureAssignment;
  private readonly secondaryClickGesture: FaceSecondaryClickGesture;
  private readonly router: FaceTextureApplyRouter;

  /**
   * Creates the texture application and its controllers.
   *
   * @param deps Selection, undo, refresh and status services.
   */
  constructor(deps: FaceTextureApplyCoordinatorDeps) {
    this.deps = deps;
    this.attributeTransferHandler = this.attributeTransferHandlerCreate();
    this.textureAssignment = this.textureAssignmentCreate();
    this.secondaryClickGesture = new FaceSecondaryClickGesture();
    this.router = new FaceTextureApplyRouter(this.actionsCreate(), deps.showStatusMessage);
  }

  /**
   * Handles a left-button face press: Alt+click transfer first, then the active
   * click mode.
   *
   * @param event Press event carrying the client point.
   * @param viewport Pressed viewport.
   * @param isCtrlPressed True while the subtractive selection modifier is held.
   * @returns True when the press is consumed; false lets selection continue.
   */
  primaryPressTryHandle(event: MouseEvent, viewport: FaceTextureApplyViewport, isCtrlPressed: boolean): boolean {
    if (this.attributeTransferHandler.tryBegin(event, viewport.camera, viewport.pickElement)) {
      return true;
    }
    const pick = this.deps.faceExtrusionController.pickFaceAtPointer(event, viewport.camera, viewport.pickElement);
    if (!pick) {
      return getStateTextureStampTool().toolActiveRead();
    }
    return this.router.primaryPressRoute({ pick, camera: viewport.camera, isCtrlPressed });
  }

  /**
   * Arms the right-button click at a press; a release without dragging applies
   * the current texture to the face under the press point.
   *
   * @param viewport Pressed viewport.
   * @param clientX Press client X.
   * @param clientY Press client Y.
   * @param dragHandler Runs once when the press becomes a camera drag.
   */
  secondaryPressBegin(
    viewport: FaceTextureApplyViewport,
    clientX: number,
    clientY: number,
    dragHandler: FaceSecondaryDragHandler | null = null,
  ): void {
    const ownerWindow = viewport.pickElement.ownerDocument.defaultView ?? window;
    this.secondaryClickGesture.begin(
      ownerWindow,
      clientX,
      clientY,
      (isAltHeld) => this.secondaryClickApply(viewport, clientX, clientY, isAltHeld || this.deps.isAltDown()),
      dragHandler,
    );
  }

  /**
   * Returns whether a right-button texture apply click is armed.
   *
   * @returns True while waiting for a click or a drag.
   */
  secondaryPressIsArmed(): boolean {
    return this.secondaryClickGesture.isArmed();
  }

  /** Paints the current texture onto the selected faces or objects. */
  stampApplyToSelection(): void {
    const textureId = getStateTexturePaint().getLastTextureId();
    this.textureAssignment.assignTextureToSelection({ id: textureId, displayName: textureId });
    this.deps.updateShadingMeshes();
  }

  /** Disarms a pending right-button click. */
  dispose(): void {
    this.secondaryClickGesture.cancel();
  }

  /**
   * Applies the current texture to the face under a completed right click.
   *
   * @param viewport Clicked viewport.
   * @param clientX Click client X.
   * @param clientY Click client Y.
   * @param isAltHeld True to apply the lifted values with the texture.
   */
  private secondaryClickApply(
    viewport: FaceTextureApplyViewport,
    clientX: number,
    clientY: number,
    isAltHeld: boolean,
  ): void {
    const event = new MouseEvent('pointerdown', { clientX, clientY, button: 2 });
    const pick = this.deps.faceExtrusionController.pickFaceAtPointer(event, viewport.camera, viewport.pickElement);
    if (pick) {
      this.router.secondaryClickRoute(pick, isAltHeld);
    }
  }

  /**
   * Creates the Alt+click attribute transfer handler.
   *
   * @returns Transfer handler.
   */
  private attributeTransferHandlerCreate(): FaceAttributeTransferHandler {
    return new FaceAttributeTransferHandler({
      commandStack: this.deps.commandStack,
      faceExtrusionController: this.deps.faceExtrusionController,
      isAltDown: this.deps.isAltDown,
      updateShadingMeshes: this.deps.updateShadingMeshes,
      showStatusMessage: this.deps.showStatusMessage,
    });
  }

  /**
   * Creates the texture assignment controller reporting to the status bar.
   *
   * @returns Texture assignment controller.
   */
  private textureAssignmentCreate(): ControllerTextureAssignment {
    const assignment = new ControllerTextureAssignment(
      this.deps.selectionManager,
      this.deps.faceExtrusionController,
      this.deps.commandStack,
    );
    assignment.setStatusCallback(this.deps.showStatusMessage);
    assignment.setAfterSolidTextureAssign(() => this.afterSurfaceEdit());
    return assignment;
  }

  /**
   * Creates the texture application actions.
   *
   * @returns Actions over this coordinator's controllers.
   */
  private actionsCreate(): FaceTextureApplyActions {
    return new FaceTextureApplyActions({
      commandStack: this.deps.commandStack,
      textureAssignment: this.textureAssignment,
      attributeTransferHandler: this.attributeTransferHandler,
      liftedSurfaceStore: new FaceLiftedSurfaceStore(),
      afterSurfaceEdit: () => this.afterSurfaceEdit(),
      showStatusMessage: this.deps.showStatusMessage,
    });
  }

  /** Pushes rebuilt solids to the viewports and refreshes shading. */
  private afterSurfaceEdit(): void {
    this.deps.syncPrimitivesToViewports();
    this.deps.updateShadingMeshes();
  }
}
