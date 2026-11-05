import { solidFaceTargetsFromSelections } from '@/selection/face/solid_face_target_resolver.js';
import {
  RouterDisplacementSculptPointer,
  type RouterDisplacementSculptPointerDeps,
} from '@/displacement/sculpt/router_displacement_sculpt_pointer.js';
import { ControllerDisplacementActions } from './controller_displacement_actions.js';
import { displacementActionsSharedInstall } from './displacement_actions_shared.js';

/**
 * Displacement tools of one face selection: the Displacement tab actions,
 * installed as the shared actions while this object lives, and the viewport
 * sculpt router.
 */
export class DisplacementFaceTools {
  /** Routes viewport drags to sculpting the selected displaced faces. */
  readonly sculptRouter: RouterDisplacementSculptPointer;
  private actionsUninstall: () => void;

  /**
   * Installs the Displacement tab actions over the face selection and creates
   * the sculpt router.
   *
   * @param deps Undo stack, face selection, Ctrl state and dab refresh.
   */
  constructor(deps: RouterDisplacementSculptPointerDeps) {
    const actions = new ControllerDisplacementActions(deps.commandStack, () =>
      solidFaceTargetsFromSelections(deps.selectedFacesRead()),
    );
    this.actionsUninstall = displacementActionsSharedInstall(actions);
    this.sculptRouter = new RouterDisplacementSculptPointer(deps);
  }

  /**
   * Ends any sculpt stroke, releases the router and removes the tab actions
   * when they are still the installed ones. Safe to call more than once.
   */
  dispose(): void {
    this.sculptRouter.dispose();
    this.actionsUninstall();
    this.actionsUninstall = () => undefined;
  }
}
