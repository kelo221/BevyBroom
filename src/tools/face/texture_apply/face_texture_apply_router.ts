import type * as THREE from 'three';
import type { FacePickResult } from '@/selection/face/raycaster_face_selection.js';
import { getStateFaceEditSession, type FaceEditPickMode } from '@/texture/paint/state_face_edit_session.js';
import { getStateTextureStampTool } from '@/tools/texture_stamp/state_texture_stamp_tool.js';
import type { FaceTextureApplyActions } from './face_texture_apply_actions.js';

/** One left-button face press the router decides on. */
export interface FaceTextureApplyPrimaryPress {
  /** Face under the pointer. */
  readonly pick: FacePickResult;
  /** Camera of the pressed viewport. */
  readonly camera: THREE.Camera;
  /** True while the toggle selection modifier is held. */
  readonly isCtrlPressed: boolean;
}

/**
 * Routes face clicks to the texture application actions: the left button by the
 * Face Edit Sheet click mode (or the Apply Current Texture tool), the
 * right-button click to apply the current texture, with Alt to apply it with
 * the lifted values.
 */
export class FaceTextureApplyRouter {
  private readonly actions: FaceTextureApplyActions;
  private readonly showStatusMessage: (message: string) => void;

  /**
   * Creates the router.
   *
   * @param actions Texture application actions.
   * @param showStatusMessage Shows a status bar message.
   */
  constructor(actions: FaceTextureApplyActions, showStatusMessage: (message: string) => void) {
    this.actions = actions;
    this.showStatusMessage = showStatusMessage;
  }

  /**
   * Runs the left-button action of the active click mode.
   *
   * @param press Pressed face, camera and modifiers.
   * @returns True when the press is consumed; false lets selection continue.
   */
  primaryPressRoute(press: FaceTextureApplyPrimaryPress): boolean {
    if (getStateTextureStampTool().toolActiveRead()) {
      this.actions.textureOnlyApply(press.pick);
      return true;
    }
    return this.primaryPressRouteByMode(getStateFaceEditSession().pickModeRead(), press);
  }

  /**
   * Runs the right-button click action.
   *
   * @param pick Clicked face.
   * @param isAltHeld True to apply the lifted values with the texture.
   * @returns True when the face changed.
   */
  secondaryClickRoute(pick: FacePickResult, isAltHeld: boolean): boolean {
    if (isAltHeld) {
      return this.actions.textureWithValuesApply(pick);
    }
    return this.actions.textureOnlyApply(pick);
  }

  /**
   * Runs the left-button action of one click mode.
   *
   * @param mode Active click mode.
   * @param press Pressed face, camera and modifiers.
   * @returns True when the press is consumed.
   */
  private primaryPressRouteByMode(mode: FaceEditPickMode, press: FaceTextureApplyPrimaryPress): boolean {
    switch (mode) {
      case 'apply':
        this.actions.textureOnlyApply(press.pick);
        return true;
      case 'apply_values':
        this.actions.textureWithValuesApply(press.pick);
        return true;
      case 'align_view':
        this.actions.alignToViewApply(press.pick, press.camera);
        return true;
      case 'lift':
        this.liftAnnounced(press.pick);
        return true;
      case 'lift_select':
        this.liftBeforeSelect(press);
        return false;
      default:
        return false;
    }
  }

  /**
   * Lifts a face and reports the lifted texture.
   *
   * @param pick Clicked face.
   */
  private liftAnnounced(pick: FacePickResult): void {
    const textureId = this.actions.lift(pick);
    if (textureId !== null) {
      this.showStatusMessage(`Lifted ${textureId} and its alignment`);
    }
  }

  /**
   * Lifts the pressed face before it gets selected; a toggle press only toggles
   * the selection and lifts nothing.
   *
   * @param press Pressed face, camera and modifiers.
   */
  private liftBeforeSelect(press: FaceTextureApplyPrimaryPress): void {
    if (press.isCtrlPressed) {
      return;
    }
    this.actions.lift(press.pick);
  }
}
