import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { solidFaceTargetsFromSelections } from '@/selection/face/solid_face_target_resolver.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { getStateDisplacementSculptPress } from '@/displacement/state/state_displacement_sculpt_press.js';
import { DisplacementSculptStroke } from './displacement_sculpt_stroke.js';
import { displacementSculptRoutingActiveIs } from './displacement_sculpt_routing.js';
import { DisplacementSurfaceRaycaster, type DisplacementSurfaceHit } from './displacement_surface_raycaster.js';
import { DisplacementBrushResizeSession } from './displacement_brush_resize_session.js';
import {
  displacementSculptModifiersResizeIs,
  displacementSculptModifiersSettingsApply,
  type DisplacementSculptModifiers,
  type DisplacementSculptPressButton,
} from './displacement_sculpt_modifiers.js';
import {
  displacementSculptStrokeSettingsFromShared,
  type DisplacementSculptStrokeSettings,
} from './displacement_sculpt_stroke_settings.js';
import {
  DisplacementSculptStrokeRepeater,
  displacementSculptFrameSchedulerBrowserCreate,
  type DisplacementSculptFrameScheduler,
} from './displacement_sculpt_stroke_repeater.js';

/** Services the viewport sculpt router works with. */
export interface RouterDisplacementSculptPointerDeps {
  /** Undo stack receiving one step per stroke. */
  readonly commandStack: CommandStack;
  /** Returns the current face selection. */
  readonly selectedFacesRead: () => FaceSelection[];
  /** Returns whether Ctrl is held, which flips raise and lower. */
  readonly isCtrlDown: () => boolean;
  /**
   * Returns whether Shift is held: Smooth for Paint Geometry, resizing with the
   * right button.
   */
  readonly isShiftDown: () => boolean;
  /** Refreshes the viewport after a dab changed geometry. */
  readonly afterDab: () => void;
  /**
   * Frame scheduler for Continuous Mouse repeats; browser animation frames when
   * omitted.
   */
  readonly frameScheduler?: DisplacementSculptFrameScheduler;
}

/**
 * Routes viewport drags to displacement sculpting while the Face Edit Sheet
 * shows its Displacement tab and a paint tool is active. Strokes paint the
 * displacement surfaces of the selected faces; with Continuous Mouse on, a held
 * pointer keeps painting every frame. Ctrl and the right button each invert the
 * paint direction, Shift turns Paint Geometry into Smooth, and Shift with the
 * right button resizes the brush instead of painting. Keys and button are read
 * once when the press starts and hold for the whole stroke.
 */
export class RouterDisplacementSculptPointer {
  private readonly surfaceRaycaster = new DisplacementSurfaceRaycaster();
  private stroke: DisplacementSculptStroke | null = null;
  private resizeSession: DisplacementBrushResizeSession | null = null;
  private targets: SolidFaceTextureTarget[] = [];
  private strokeSeed = 1;
  private readonly repeater: DisplacementSculptStrokeRepeater;

  /**
   * Creates the router.
   *
   * @param deps Undo stack, face selection, modifier keys, refresh and frame
   *   services.
   */
  constructor(private readonly deps: RouterDisplacementSculptPointerDeps) {
    this.repeater = new DisplacementSculptStrokeRepeater(
      deps.frameScheduler ?? displacementSculptFrameSchedulerBrowserCreate(),
      (center) => this.dabApply(center),
    );
  }

  /**
   * Returns whether viewport presses should sculpt instead of selecting.
   *
   * @returns True while the Displacement tab is open with a paint tool active.
   */
  isRoutingActive(): boolean {
    return displacementSculptRoutingActiveIs();
  }

  /**
   * Returns whether a stroke or a brush resize is in progress.
   *
   * @returns True between a consumed press and its release.
   */
  isStrokeActive(): boolean {
    return this.stroke !== null || this.resizeSession !== null;
  }

  /**
   * Starts a stroke, or a brush resize for Shift with the right button, when
   * the press hits a selected displaced face.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @param pressButton Mouse button of the press; the right button inverts the
   *   paint direction.
   * @returns True when a stroke or resize started.
   */
  strokeTryBegin(
    event: MouseEvent,
    camera: THREE.Camera,
    pickElement: HTMLElement,
    pressButton: DisplacementSculptPressButton = 'primary',
  ): boolean {
    if (!this.isRoutingActive()) {
      return false;
    }
    this.targets = solidFaceTargetsFromSelections(this.deps.selectedFacesRead());
    const hit = this.surfaceRaycaster.hitRead(event, camera, pickElement, this.targets);
    if (!hit) {
      return false;
    }
    const modifiers = this.modifiersRead(pressButton);
    if (displacementSculptModifiersResizeIs(modifiers)) {
      this.resizeBegin(hit, event.clientX, modifiers);
    } else {
      this.strokeBegin(hit.point, modifiers);
    }
    return true;
  }

  /**
   * Paints one dab where the pointer now hits a selected displaced face, or
   * resizes the brush from the pointer's horizontal travel.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @returns True when a stroke or resize is active and consumed the sample.
   */
  strokeContinue(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    if (this.resizeSession) {
      this.resizeSession.pointerUpdate(event.clientX);
      return true;
    }
    if (!this.stroke) {
      return false;
    }
    const hitPoint = this.surfaceRaycaster.hitRead(event, camera, pickElement, this.targets)?.point ?? null;
    if (hitPoint) {
      this.dabApply(hitPoint);
      this.repeater.centerUpdate(hitPoint);
    }
    return true;
  }

  /**
   * Ends the stroke and folds its dabs into one undo step, or ends a brush
   * resize.
   *
   * @returns Number of dabs that changed geometry, 0 without a stroke.
   */
  strokeEnd(): number {
    this.repeater.stop();
    if (this.isStrokeActive()) {
      getStateDisplacementSculptPress().pressWrite(null);
    }
    const stroke = this.stroke;
    this.stroke = null;
    this.resizeSession = null;
    this.targets = [];
    return stroke ? stroke.finish() : 0;
  }

  /** Ends any stroke in progress and releases the surface raycaster. */
  dispose(): void {
    this.strokeEnd();
    this.surfaceRaycaster.dispose();
  }

  /**
   * Reads the keys held now together with the press button.
   *
   * @param pressButton Mouse button of the press.
   * @returns Press modifiers.
   */
  private modifiersRead(pressButton: DisplacementSculptPressButton): DisplacementSculptModifiers {
    return {
      isCtrlDown: this.deps.isCtrlDown(),
      isShiftDown: this.deps.isShiftDown(),
      isSecondaryButton: pressButton === 'secondary',
    };
  }

  /**
   * Starts a brush resize anchored at the pressed surface point.
   *
   * @param hit Surface point under the press.
   * @param clientX Press client X.
   * @param modifiers Keys and button of the press.
   */
  private resizeBegin(hit: DisplacementSurfaceHit, clientX: number, modifiers: DisplacementSculptModifiers): void {
    this.resizeSession = new DisplacementBrushResizeSession(hit, clientX);
    getStateDisplacementSculptPress().pressWrite({ modifiers, resizeAnchor: this.resizeSession.anchor });
  }

  /**
   * Starts a paint stroke and paints its first dab.
   *
   * @param center World-space center of the first dab.
   * @param modifiers Keys and button of the press.
   */
  private strokeBegin(center: THREE.Vector3, modifiers: DisplacementSculptModifiers): void {
    this.stroke = new DisplacementSculptStroke(
      this.deps.commandStack,
      this.targets,
      this.strokeSettingsBuild(modifiers),
    );
    this.strokeSeed += 1;
    getStateDisplacementSculptPress().pressWrite({ modifiers, resizeAnchor: null });
    this.dabApply(center);
    this.repeaterStartWhenContinuous(center);
  }

  /**
   * Starts repeating dabs at a center when Continuous Mouse is on.
   *
   * @param center World-space dab center of the stroke's first dab.
   */
  private repeaterStartWhenContinuous(center: THREE.Vector3): void {
    if (getStateDisplacementSculpt().settingsRead().continuousMouse) {
      this.repeater.start(center);
    }
  }

  /**
   * Paints one dab and refreshes the viewport when geometry changed.
   *
   * @param center World-space dab center.
   */
  private dabApply(center: THREE.Vector3): void {
    if (this.stroke && this.stroke.dabApply(center) > 0) {
      this.deps.afterDab();
    }
  }

  /**
   * Builds the stroke settings from the shared Displacement tab settings and
   * the press modifiers.
   *
   * @param modifiers Keys and button of the press.
   * @returns Every paint setting of the new stroke.
   */
  private strokeSettingsBuild(modifiers: DisplacementSculptModifiers): DisplacementSculptStrokeSettings {
    const settings = displacementSculptModifiersSettingsApply(getStateDisplacementSculpt().settingsRead(), modifiers);
    return displacementSculptStrokeSettingsFromShared(settings, settings.raise ? 1 : -1, this.strokeSeed);
  }
}
