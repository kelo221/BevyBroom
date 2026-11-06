import type * as THREE from 'three';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { DisplacementOverlayPresenter } from './displacement_overlay_presenter.js';
import { DisplacementBrushCursor } from './displacement_brush_cursor.js';
import {
  RouterDisplacementBrushHover,
  type DisplacementBrushHoverViewport,
} from './router_displacement_brush_hover.js';

/** Services the displacement viewport helpers work with. */
export interface DisplacementOverlaySystemDeps {
  /** Editor-only helper parent outside the world hierarchy. */
  readonly helperParent: THREE.Object3D;
  /** Returns the editor world root. */
  readonly worldRootRead: () => THREE.Object3D;
  /** Returns whether face selection mode is active. */
  readonly isFaceModeActive: () => boolean;
  /** Returns every viewport the pointer may hover. */
  readonly viewportsRead: () => readonly DisplacementBrushHoverViewport[];
  /** Returns the current face selection. */
  readonly selectedFacesRead: () => FaceSelection[];
  /** Returns whether Ctrl is held. */
  readonly isCtrlDown: () => boolean;
  /** Returns whether Shift is held. */
  readonly isShiftDown: () => boolean;
}

/**
 * Displacement viewport helpers: grid wireframes and alpha tints over every
 * displacement surface, and the paint cursor that follows the pointer over
 * selected displaced faces. All of them live under the helper parent, never in
 * the world.
 */
export class DisplacementOverlaySystem {
  /** Grid wireframes and alpha tints. */
  readonly presenter: DisplacementOverlayPresenter;
  /** Paint cursor. */
  readonly cursor: DisplacementBrushCursor;
  /** Pointer hover routing for the paint cursor. */
  readonly hoverRouter: RouterDisplacementBrushHover;

  /**
   * Creates every displacement viewport helper.
   *
   * @param deps Helper parent, world, face mode, viewport, selection and Ctrl
   *   services.
   */
  constructor(deps: DisplacementOverlaySystemDeps) {
    this.presenter = new DisplacementOverlayPresenter(deps);
    this.cursor = new DisplacementBrushCursor();
    deps.helperParent.add(this.cursor.root);
    this.hoverRouter = new RouterDisplacementBrushHover({ ...deps, cursor: this.cursor });
  }

  /** Updates overlays and the paint cursor for the coming frame. */
  frameUpdate(): void {
    this.presenter.frameUpdate();
    this.hoverRouter.frameRefresh();
  }

  /** Removes and releases every displacement viewport helper. */
  dispose(): void {
    this.hoverRouter.dispose();
    this.cursor.dispose();
    this.presenter.dispose();
  }
}
