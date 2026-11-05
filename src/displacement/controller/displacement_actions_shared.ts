import type { ControllerDisplacementActions } from './controller_displacement_actions.js';

let sharedDisplacementActions: ControllerDisplacementActions | null = null;

/**
 * Makes a displacement actions controller the one the Displacement tab uses.
 *
 * @param actions Actions bound to the editor's face selection and undo stack.
 * @returns Function that removes the controller again when it is still the
 *   installed one.
 */
export function displacementActionsSharedInstall(actions: ControllerDisplacementActions): () => void {
  sharedDisplacementActions = actions;
  return () => {
    if (sharedDisplacementActions === actions) {
      sharedDisplacementActions = null;
    }
  };
}

/**
 * Returns the installed displacement actions controller.
 *
 * @returns Installed controller, or null when the face tools are not set up.
 */
export function displacementActionsSharedRead(): ControllerDisplacementActions | null {
  return sharedDisplacementActions;
}
