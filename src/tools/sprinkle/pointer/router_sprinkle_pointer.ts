import type * as THREE from 'three';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import type { SprinklePlacementMode, SprinkleSurfaceHit } from '@/tools/sprinkle/sprinkle_types.js';
import { SprinklePlacementModeRules } from '@/tools/sprinkle/placement/sprinkle_placement_mode_rules.js';
import type { SprinkleStroke } from '@/tools/sprinkle/stroke/sprinkle_stroke.js';
import {
  sprinkleStrokeCreate,
  sprinkleSurfaceProjectorCreate,
  type SprinkleStrokeServices,
} from '@/tools/sprinkle/stroke/sprinkle_stroke_factory.js';
import { sprinkleStrokeResultEmpty, type SprinkleStrokeResult } from '@/tools/sprinkle/stroke/sprinkle_stroke_types.js';
import type { SprinkleSurfaceProjector } from '@/tools/sprinkle/surface/sprinkle_surface_projector.js';
import { SprinkleBrushResizeSession } from './sprinkle_brush_resize_session.js';

/** Mouse button of a Sprinkle press. */
export type SprinklePressButton = 'primary' | 'secondary';

/** Services the Sprinkle pointer router works with. */
export interface RouterSprinklePointerDeps extends SprinkleStrokeServices {
  /** Returns whether Ctrl is held, which makes a stroke subtractive. */
  readonly isCtrlDown: () => boolean;
}

/**
 * Routes viewport presses to Sprinkle painting while the Sprinkle tool is
 * active. A left press over a surface starts a stroke that paints a dab at
 * every pointer sample until the release, which records one undo step; Ctrl at
 * the press makes the stroke subtractive. A right press over a surface resizes
 * the brush from the pointer's horizontal travel instead.
 */
export class RouterSprinklePointer {
  private projector: SprinkleSurfaceProjector | null = null;
  private stroke: SprinkleStroke | null = null;
  private strokeMode: SprinklePlacementMode | null = null;
  private resizeSession: SprinkleBrushResizeSession | null = null;
  private isPressWithoutStroke = false;
  private strokeCount = 0;

  /**
   * Creates the router.
   *
   * @param deps Undo stack, world, modifier keys, status and refresh services.
   */
  constructor(private readonly deps: RouterSprinklePointerDeps) {}

  /**
   * Returns whether viewport presses should paint instead of selecting.
   *
   * @returns True while the Sprinkle tool is active.
   */
  isRoutingActive(): boolean {
    return getStateSprinkleTool().toolActiveRead();
  }

  /**
   * Returns whether a press is held: a stroke, a resize, or a press that found
   * no definition to paint.
   *
   * @returns True between a consumed press and its release.
   */
  isPressActive(): boolean {
    return this.stroke !== null || this.resizeSession !== null || this.isPressWithoutStroke;
  }

  /**
   * Returns where the radius cursor stays while the brush is resized.
   *
   * @returns Anchor point, or null when no resize is in progress.
   */
  resizeAnchorRead(): THREE.Vector3 | null {
    return this.resizeSession ? this.resizeSession.anchor : null;
  }

  /**
   * Returns whether the cursor should show the subtractive look: during a
   * subtractive stroke, or while Ctrl is held without a press.
   *
   * @returns True when painting would remove entities.
   */
  isSubtractiveShown(): boolean {
    if (this.stroke) {
      return this.strokeMode === 'SUBTRACTIVE';
    }
    return getStateSprinkleTool().configRead().mode === 'SUBTRACTIVE' || this.deps.isCtrlDown();
  }

  /**
   * Starts a stroke, or a brush resize for the right button, when the press
   * hits a surface while the Sprinkle tool is active.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @param pressButton Mouse button of the press.
   * @returns True when the press hit a surface and is now held.
   */
  strokeTryBegin(
    event: MouseEvent,
    camera: THREE.Camera,
    pickElement: HTMLElement,
    pressButton: SprinklePressButton = 'primary',
  ): boolean {
    if (!this.isRoutingActive() || this.isPressActive()) {
      return false;
    }
    const projector = sprinkleSurfaceProjectorCreate(this.deps);
    const hit = projector.projectPointer(event, camera, pickElement);
    if (!hit) {
      return false;
    }
    if (pressButton === 'secondary') {
      this.resizeSession = new SprinkleBrushResizeSession(hit.point, event.clientX);
    } else {
      this.strokeBegin(projector, hit);
    }
    return true;
  }

  /**
   * Paints a dab where the pointer now hits a surface, or resizes the brush
   * from the pointer's horizontal travel.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @returns True when a held press consumed the sample.
   */
  strokeContinue(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    if (this.resizeSession) {
      this.resizeSession.pointerUpdate(event.clientX);
      return true;
    }
    if (!this.stroke || !this.projector) {
      return this.isPressWithoutStroke;
    }
    const hit = this.projector.projectPointer(event, camera, pickElement);
    if (hit) {
      this.stroke.dabApply(hit);
    }
    return true;
  }

  /**
   * Ends the held press; a stroke records its changes as one undo step.
   *
   * @returns Entities the stroke added and removed; nothing for resizes.
   */
  strokeEnd(): SprinkleStrokeResult {
    const stroke = this.stroke;
    this.stroke = null;
    this.strokeMode = null;
    this.projector = null;
    this.resizeSession = null;
    this.isPressWithoutStroke = false;
    return stroke ? stroke.finish() : sprinkleStrokeResultEmpty();
  }

  /** Ends any press in progress. */
  dispose(): void {
    this.strokeEnd();
  }

  /**
   * Starts a stroke with the configured definition and paints its first dab, or
   * holds the press and reports why no stroke could start.
   *
   * @param projector Projector over the surfaces of the world at the press.
   * @param hit Surface point under the press.
   */
  private strokeBegin(projector: SprinkleSurfaceProjector, hit: SprinkleSurfaceHit): void {
    const config = getStateSprinkleTool().configRead();
    const mode = SprinklePlacementModeRules.pressModeResolve(config.mode, this.deps.isCtrlDown());
    this.strokeCount += 1;
    const created = sprinkleStrokeCreate(this.deps, projector, config, { mode, seed: config.seed + this.strokeCount });
    if (!created.ok) {
      this.isPressWithoutStroke = true;
      this.deps.statusShow(created.message);
      return;
    }
    this.stroke = created.stroke;
    this.strokeMode = mode;
    this.projector = projector;
    this.stroke.dabApply(hit);
  }
}
