import * as THREE from 'three';
import { Theme } from '@/theme.js';

/** Color of the sprinkle radius sphere. */
const SPRINKLE_BRUSH_CURSOR_SPHERE_COLOR = Theme.sprinkleCursorSphereColor;

/** Color of the sprinkle radius sphere while painting would remove entities. */
const SPRINKLE_BRUSH_CURSOR_SUBTRACTIVE_COLOR = Theme.sprinkleCursorSubtractiveColor;

/** Longitude segments of the unit sprinkle radius sphere. */
const SPRINKLE_BRUSH_CURSOR_SPHERE_WIDTH_SEGMENTS = 12;

/** Latitude segments of the unit sprinkle radius sphere. */
const SPRINKLE_BRUSH_CURSOR_SPHERE_HEIGHT_SEGMENTS = 8;

/** Render order drawing the cursor after the scene content. */
const SPRINKLE_BRUSH_CURSOR_RENDER_ORDER = 1000;

/**
 * Hammer-style Sprinkle tool cursor: a low-poly wireframe sphere sized to the
 * scatter radius at the hovered surface point. Editor-only; drawn over the
 * scene and never hit by raycasts.
 */
export class SprinkleBrushCursor {
  /** Root group placed at the hovered point. */
  readonly root: THREE.Group;
  /** Unit wireframe sphere scaled to the scatter radius. */
  readonly sphere: THREE.LineSegments;
  private readonly sphereMaterial: THREE.LineBasicMaterial;

  /** Creates the hidden cursor. */
  constructor() {
    this.sphereMaterial = new THREE.LineBasicMaterial({
      color: SPRINKLE_BRUSH_CURSOR_SPHERE_COLOR,
      depthTest: false,
      toneMapped: false,
    });
    this.sphere = new THREE.LineSegments(SprinkleBrushCursor.sphereGeometryBuild(), this.sphereMaterial);
    this.root = new THREE.Group();
    this.root.name = 'sprinkle_brush_cursor';
    this.root.add(this.sphere);
    this.drawOverSceneApply();
    SprinkleBrushCursor.helperMark(this.root);
    this.hide();
  }

  /**
   * Shows the cursor at a surface hit sized to the sprinkle scatter radius.
   *
   * @param point World surface point the cursor sits at.
   * @param radius Scatter radius of the active Sprinkle configuration.
   * @param isSubtractive Whether painting would remove entities, which shows
   *   the subtractive color.
   */
  showAt(point: THREE.Vector3, radius: number, isSubtractive: boolean = false): void {
    this.root.position.copy(point);
    this.root.visible = true;
    this.sphere.scale.setScalar(Math.max(radius, Number.EPSILON));
    this.sphereMaterial.color.setHex(
      isSubtractive ? SPRINKLE_BRUSH_CURSOR_SUBTRACTIVE_COLOR : SPRINKLE_BRUSH_CURSOR_SPHERE_COLOR,
    );
  }

  /**
   * Returns the color the sphere is drawn in now.
   *
   * @returns Color as a hex number.
   */
  colorHexRead(): number {
    return this.sphereMaterial.color.getHex();
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
  }

  /** Makes every cursor part ignore depth and draw after the scene content. */
  private drawOverSceneApply(): void {
    this.root.traverse((child) => {
      child.renderOrder = SPRINKLE_BRUSH_CURSOR_RENDER_ORDER;
      const material = (child as THREE.Object3D & { material?: THREE.Material }).material;
      if (material) {
        material.depthTest = false;
      }
    });
  }

  /**
   * Marks an object and its descendants as editor-only helpers that raycasts
   * never hit.
   *
   * @param object Helper object to mark.
   */
  private static helperMark(object: THREE.Object3D): void {
    object.traverse((child) => {
      child.userData['isSprinkleOverlayHelper'] = true;
      child.raycast = () => {};
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
      SPRINKLE_BRUSH_CURSOR_SPHERE_WIDTH_SEGMENTS,
      SPRINKLE_BRUSH_CURSOR_SPHERE_HEIGHT_SEGMENTS,
    );
    const wireframe = new THREE.WireframeGeometry(sphere);
    sphere.dispose();
    return wireframe;
  }
}
