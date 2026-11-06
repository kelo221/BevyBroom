import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import {
  solidFaceSelectionSeedsFromTargets,
  solidFaceTargetsFromSelections,
} from '@/selection/face/solid_face_target_resolver.js';
import {
  RouterDisplacementSculptPointer,
  type RouterDisplacementSculptPointerDeps,
} from '@/displacement/sculpt/router_displacement_sculpt_pointer.js';
import { ControllerDisplacementActions } from './controller_displacement_actions.js';
import {
  displacementActionsSharedChangeNotify,
  displacementActionsSharedInstall,
} from './displacement_actions_shared.js';

/** Face selection the displacement tools read, change and watch. */
export interface DisplacementFaceSelectionSource {
  /**
   * Returns the current face selection.
   *
   * @returns Selected faces.
   */
  getSelectedFaces(): FaceSelection[];
  /**
   * Selects face seeds in one batch.
   *
   * @param seeds Face seeds to select.
   * @param addToSelection When false, the current selection is replaced.
   */
  selectFaceSeeds(seeds: FaceSelection[], addToSelection: boolean): void;
  /**
   * Adds a face selection change listener.
   *
   * @param listener Invoked with the current face list.
   * @returns Function that removes the listener.
   */
  faceSelectionListenerAdd(listener: (faces: FaceSelection[]) => void): () => void;
}

/** Services the displacement tools of one face selection work with. */
export interface DisplacementFaceToolsDeps extends Omit<RouterDisplacementSculptPointerDeps, 'selectedFacesRead'> {
  /** Face selection the tools act on. */
  readonly faceSelection: DisplacementFaceSelectionSource;
}

/**
 * Displacement tools of one face selection: the Displacement tab actions,
 * installed as the shared actions while this object lives, and the viewport
 * sculpt router. Face selection and undo stack changes notify the shared
 * actions' change listeners.
 */
export class DisplacementFaceTools {
  /** Routes viewport drags to sculpting the selected displaced faces. */
  readonly sculptRouter: RouterDisplacementSculptPointer;
  private actionsUninstall: () => void;
  private readonly selectionListenerRemove: () => void;
  private readonly commandStackListenerRemove: () => void;

  /**
   * Installs the Displacement tab actions over the face selection, creates the
   * sculpt router and starts forwarding selection and history changes.
   *
   * @param deps Undo stack, face selection, Ctrl state and dab refresh.
   */
  constructor(deps: DisplacementFaceToolsDeps) {
    const selectedFacesRead = (): FaceSelection[] => deps.faceSelection.getSelectedFaces();
    const actions = new ControllerDisplacementActions(
      deps.commandStack,
      () => solidFaceTargetsFromSelections(selectedFacesRead()),
      (targets, addToSelection) =>
        deps.faceSelection.selectFaceSeeds(solidFaceSelectionSeedsFromTargets(targets), addToSelection),
    );
    this.actionsUninstall = displacementActionsSharedInstall(actions);
    this.sculptRouter = new RouterDisplacementSculptPointer({ ...deps, selectedFacesRead });
    this.selectionListenerRemove = deps.faceSelection.faceSelectionListenerAdd(() =>
      displacementActionsSharedChangeNotify(),
    );
    this.commandStackListenerRemove = DisplacementFaceTools.commandStackListen(deps);
  }

  /**
   * Ends any sculpt stroke, releases the router, stops forwarding changes and
   * removes the tab actions when they are still the installed ones. Safe to
   * call more than once.
   */
  dispose(): void {
    this.sculptRouter.dispose();
    this.selectionListenerRemove();
    this.commandStackListenerRemove();
    this.actionsUninstall();
    this.actionsUninstall = () => undefined;
  }

  /**
   * Forwards undo stack changes to the shared actions' change listeners.
   *
   * @param deps Services holding the undo stack.
   * @returns Function that stops forwarding.
   */
  private static commandStackListen(deps: DisplacementFaceToolsDeps): () => void {
    const listener = (): void => displacementActionsSharedChangeNotify();
    deps.commandStack.onStackChanged(listener);
    return () => deps.commandStack.offStackChanged(listener);
  }
}
