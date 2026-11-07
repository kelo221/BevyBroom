import { CommandStack } from '@/commands/command_stack.js';
import { DisplacementFaceTools } from '@/displacement/controller/displacement_face_tools.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from './controller_face_extrusion.js';
import { FaceTextureApplyCoordinator } from './texture_apply/face_texture_apply_coordinator.js';

/** Services the face-mode texture apply and displacement tools need. */
export interface CoordinatorFaceModeToolDeps {
  readonly commandStack: CommandStack;
  readonly selectionManager: ManagerSelection;
  readonly keyboardShortcutHandler: HandlerKeyboardShortcut;
  readonly updateShadingMeshes: () => void;
  readonly syncPrimitivesToViewports: () => void;
  readonly showStatusMessage: (message: string) => void;
}

/**
 * Creates the texture application bound to a face mode coordinator's services.
 *
 * @param deps Coordinator services.
 * @param faceExtrusionController Face selection the application paints onto.
 * @returns Wired texture application.
 */
export function coordinatorFaceModeTextureApplyCreate(
  deps: CoordinatorFaceModeToolDeps,
  faceExtrusionController: ControllerFaceExtrusion,
): FaceTextureApplyCoordinator {
  return new FaceTextureApplyCoordinator({
    commandStack: deps.commandStack,
    selectionManager: deps.selectionManager,
    faceExtrusionController,
    isAltDown: () => deps.keyboardShortcutHandler.isAltDown(),
    updateShadingMeshes: () => deps.updateShadingMeshes(),
    syncPrimitivesToViewports: () => deps.syncPrimitivesToViewports(),
    showStatusMessage: (message) => deps.showStatusMessage(message),
  });
}

/**
 * Creates the displacement tools bound to a face mode coordinator's selection.
 *
 * @param deps Coordinator services.
 * @param faceExtrusionController Face selection the tools sculpt.
 * @param afterDab Refreshes shading and the face highlight after a dab.
 * @returns Displacement tab actions and viewport sculpt router.
 */
export function coordinatorFaceModeDisplacementToolsCreate(
  deps: CoordinatorFaceModeToolDeps,
  faceExtrusionController: ControllerFaceExtrusion,
  afterDab: () => void,
): DisplacementFaceTools {
  return new DisplacementFaceTools({
    commandStack: deps.commandStack,
    faceSelection: faceExtrusionController,
    isCtrlDown: () => deps.keyboardShortcutHandler.modifiersStateRead().ctrl,
    isShiftDown: () => deps.keyboardShortcutHandler.modifiersStateRead().shift,
    afterDab,
  });
}
