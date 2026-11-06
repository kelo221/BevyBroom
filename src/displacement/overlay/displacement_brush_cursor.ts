import * as THREE from 'three';
import { Theme } from '@/theme.js';
import type { DisplacementSculptSettings } from '@/displacement/state/state_displacement_sculpt.js';
import { displacementSculptAxisVectorRead } from '@/displacement/sculpt/displacement_sculpt_stroke_settings.js';
import type { DisplacementSurfaceHit } from '@/displacement/sculpt/displacement_surface_raycaster.js';
import { displacementOverlayHelperMark } from './displacement_overlay_helper_flags.js';

/** Color of the paint radius sphere. */
const DISPLACEMENT_BRUSH_CURSOR_SPHERE_COLOR = Theme.displacementCursorSphereColor;

/** Color of the paint direction arrow. */
const DISPLACEMENT_BRUSH_CURSOR_ARROW_COLOR = Theme.displacementCursorArrowColor;

/** Longitude segments of the unit paint radius sphere. */
const DISPLACEMENT_BRUSH_CURSOR_SPHERE_WIDTH_SEGMENTS = 12;

/** Latitude segments of the unit paint radius sphere. */
const DISPLACEMENT_BRUSH_CURSOR_SPHERE_HEIGHT_SEGMENTS = 8;

/** Arrow head length as a share of the arrow length. */
const DISPLACEMENT_BRUSH_CURSOR_HEAD_LENGTH_SHARE = 0.2;

/** Arrow head width as a share of the arrow length. */
const DISPLACEMENT_BRUSH_CURSOR_HEAD_WIDTH_SHARE = 0.1;

/** Render order drawing the cursor after the scene content. */
const DISPLACEMENT_BRUSH_CURSOR_RENDER_ORDER = 1000;

/**
 * Hammer-style displacement paint cursor: a low-poly green wireframe sphere
 * sized to the paint radius at the hovered surface point, and for Paint
 * Geometry a yellow arrow along the paint direction as long as the paint
 * distance. Editor-only; drawn over the scene.
 */
export class DisplacementBrushCursor {
  /** Root group placed at the hovered point. */
  readonly root: THREE.Group;
  /** Unit wireframe sphere scaled to the paint radius. */
  readonly sphere: THREE.LineSegments;
  /** Paint direction arrow. */
  readonly arrow: THREE.ArrowHelper;
  private readonly sphereMaterial: THREE.LineBasicMaterial;
  private readonly direction = new THREE.Vector3();

  /** Creates the hidden cursor. */
  constructor() {
    this.sphereMaterial = new THREE.LineBasicMaterial({
      color: DISPLACEMENT_BRUSH_CURSOR_SPHERE_COLOR,
      depthTest: false,
      toneMapped: false,
    });
    this.sphere = new THREE.LineSegments(DisplacementBrushCursor.sphereGeometryBuild(), this.sphereMaterial);
    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      1,
      DISPLACEMENT_BRUSH_CURSOR_ARROW_COLOR,
    );
    this.root = new THREE.Group();
    this.root.name = 'displacement_brush_cursor';
    this.root.add(this.sphere, this.arrow);
    this.drawOverSceneApply();
    displacementOverlayHelperMark(this.root);
    this.hide();
  }

  /**
   * Shows the cursor at a surface hit for the paint settings of the press. The
   * arrow shows for Paint Geometry effects other than Smooth.
   *
   * @param hit Displacement surface point and normal the cursor sits at.
   * @param settings Displacement tab settings with Raise and the effect
   *   resolved for the held keys and button.
   */
  showAt(hit: DisplacementSurfaceHit, settings: Readonly<DisplacementSculptSettings>): void {
    this.root.position.copy(hit.point);
    this.root.visible = true;
    this.sphere.scale.setScalar(Math.max(settings.radius, Number.EPSILON));
    this.arrow.visible =
      settings.activeTool === 'paint_geometry' && settings.effect !== 'smooth' && settings.distance > 0;
    if (this.arrow.visible) {
      this.arrowAim(hit.normal, settings);
    }
  }

  /** Hides the cursor. */
  hide(): void {
    this.root.visible = false;
  }

  /**
   * Returns whether the cursor is shown.
   *
   * @returns True while visible.
   */
  isVisible(): boolean {
    return this.root.visible;
  }

  /** Detaches the cursor and releases its geometries and materials. */
  dispose(): void {
    this.root.removeFromParent();
    this.sphere.geometry.dispose();
    this.sphereMaterial.dispose();
    this.arrow.dispose();
  }

  /**
   * Points the arrow along the paint axis, flipped when Raise is off, and sizes
   * it to the paint distance.
   *
   * @param surfaceNormal World normal of the hovered surface.
   * @param settings Displacement tab settings resolved for the press.
   */
  private arrowAim(surfaceNormal: THREE.Vector3, settings: Readonly<DisplacementSculptSettings>): void {
    this.direction.copy(displacementSculptAxisVectorRead(settings.axis) ?? surfaceNormal).normalize();
    if (!settings.raise) {
      this.direction.negate();
    }
    this.arrow.setDirection(this.direction);
    this.arrow.setLength(
      settings.distance,
      settings.distance * DISPLACEMENT_BRUSH_CURSOR_HEAD_LENGTH_SHARE,
      settings.distance * DISPLACEMENT_BRUSH_CURSOR_HEAD_WIDTH_SHARE,
    );
  }

  /** Makes every cursor part ignore depth and draw after the scene content. */
  private drawOverSceneApply(): void {
    this.root.traverse((child) => {
      child.renderOrder = DISPLACEMENT_BRUSH_CURSOR_RENDER_ORDER;
      const material = (child as THREE.Object3D & { material?: THREE.Material }).material;
      if (material) {
        material.depthTest = false;
      }
    });
  }

  /**
   * Builds the wireframe of a unit low-poly sphere.
   *
   * @returns Wireframe line geometry.
   */
  private static sphereGeometryBuild(): THREE.BufferGeometry {
    const sphere = new THREE.SphereGeometry(
      1,
      DISPLACEMENT_BRUSH_CURSOR_SPHERE_WIDTH_SEGMENTS,
      DISPLACEMENT_BRUSH_CURSOR_SPHERE_HEIGHT_SEGMENTS,
    );
    const wireframe = new THREE.WireframeGeometry(sphere);
    sphere.dispose();
    return wireframe;
  }
}
