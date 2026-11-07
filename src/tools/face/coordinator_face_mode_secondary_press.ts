import { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { Viewport2D } from '@/viewports/core/viewport_2d.js';
import type { FaceTextureApplyCoordinator } from './texture_apply/face_texture_apply_coordinator.js';
import type { FaceSelectSecondaryPressResult } from '@/editor/tools/face_select/face_select_secondary_press_result.js';

/** Viewport a Face Select right-button press landed in. */
type FaceModeSecondaryPressViewport = Viewport3D | Viewport2D;

/** Starts a displacement paint stroke on a right-button press. */
export type FaceModeSecondaryPaintStrokeBegin = (
  viewport: FaceModeSecondaryPressViewport,
  clientX: number,
  clientY: number,
) => boolean;

/** Texture apply and delayed look for a Face Select right-button press. */
export class CoordinatorFaceModeSecondaryPress {
  private readonly textureApplyCoordinator: FaceTextureApplyCoordinator;
  private readonly paintStrokeBegin: FaceModeSecondaryPaintStrokeBegin;
  private secondaryApplyViewport: FaceModeSecondaryPressViewport | null;

  /**
   * Creates the right-button apply and delayed-look helper.
   *
   * @param textureApplyCoordinator Texture apply click coordinator.
   * @param paintStrokeBegin Starts a displacement paint stroke when one
   *   applies.
   */
  constructor(
    textureApplyCoordinator: FaceTextureApplyCoordinator,
    paintStrokeBegin: FaceModeSecondaryPaintStrokeBegin,
  ) {
    this.textureApplyCoordinator = textureApplyCoordinator;
    this.paintStrokeBegin = paintStrokeBegin;
    this.secondaryApplyViewport = null;
  }

  /**
   * Starts a paint stroke or arms the texture apply click on a right-button
   * press.
   *
   * @param viewport Pressed viewport.
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Whether the press hit a viewport and whether a paint stroke
   *   started.
   */
  pressBegin(
    viewport: FaceModeSecondaryPressViewport,
    clientX: number,
    clientY: number,
  ): FaceSelectSecondaryPressResult {
    if (this.paintStrokeBegin(viewport, clientX, clientY)) {
      return { viewportHit: true, strokeStarted: true };
    }
    this.applyClickArm(viewport, clientX, clientY);
    return { viewportHit: true, strokeStarted: false };
  }

  /**
   * Returns whether a right-button texture apply click is armed.
   *
   * @returns True while waiting for a click or a drag.
   */
  applyClickIsArmed(): boolean {
    return this.textureApplyCoordinator.secondaryPressIsArmed();
  }

  /** Cancels an armed apply click and forgets the pressed viewport. */
  applyClickCancel(): void {
    this.secondaryApplyViewport = null;
    this.textureApplyCoordinator.dispose();
  }

  /** Cancels an armed apply click. */
  dispose(): void {
    this.applyClickCancel();
  }

  /**
   * Arms the right-button texture apply click and starts look or pan when the
   * press becomes a drag.
   *
   * @param viewport Pressed viewport.
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   */
  private applyClickArm(viewport: FaceModeSecondaryPressViewport, clientX: number, clientY: number): void {
    this.secondaryApplyViewport = viewport;
    const pressed = { camera: viewport.getCamera(), pickElement: viewport.getContentElement() };
    this.textureApplyCoordinator.secondaryPressBegin(pressed, clientX, clientY, (event) =>
      this.dragNavigationBegin(event),
    );
  }

  /**
   * Hands a right-button apply press that became a drag to the pressed
   * viewport's look or pan, or cancels the press when no viewport is known.
   *
   * @param event Move that crossed the click threshold.
   */
  private dragNavigationBegin(event: PointerEvent): void {
    const viewport = this.secondaryApplyViewport;
    this.secondaryApplyViewport = null;
    if (!viewport) {
      this.applyClickCancel();
      return;
    }
    viewport.beginSecondaryButtonNavigation(event);
  }
}
