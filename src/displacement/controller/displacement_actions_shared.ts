import type { ControllerDisplacementActions } from './controller_displacement_actions.js';

let sharedDisplacementActions: ControllerDisplacementActions | null = null;

/** Listeners told when the installed actions or the faces they read change. */
const sharedDisplacementActionsChangeListeners = new Set<() => void>();

/**
 * Makes a displacement actions controller the one the Displacement tab uses and
 * notifies the change listeners.
 *
 * @param actions Actions bound to the editor's face selection and undo stack.
 * @returns Function that removes the controller again when it is still the
 *   installed one.
 */
export function displacementActionsSharedInstall(actions: ControllerDisplacementActions): () => void {
  sharedDisplacementActions = actions;
  displacementActionsSharedChangeNotify();
  return () => {
    if (sharedDisplacementActions === actions) {
      sharedDisplacementActions = null;
      displacementActionsSharedChangeNotify();
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

/**
 * Subscribes to changes of the installed actions, of the face selection they
 * read and of the faces' displacements.
 *
 * @param listener Callback invoked on change.
 * @returns Unsubscribe function.
 */
export function displacementActionsSharedChangeListenerAdd(listener: () => void): () => void {
  sharedDisplacementActionsChangeListeners.add(listener);
  return () => {
    sharedDisplacementActionsChangeListeners.delete(listener);
  };
}

/**
 * Tells every change listener that the selected faces or their displacements
 * changed.
 */
export function displacementActionsSharedChangeNotify(): void {
  sharedDisplacementActionsChangeListeners.forEach((listener) => listener());
}
