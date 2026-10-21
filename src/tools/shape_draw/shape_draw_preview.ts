import * as THREE from 'three';
import { Theme } from '@/theme.js';
import type { ShapeDrawWorldBox } from './shape_draw_world_box.js';

/** UserData key marking the editor-only shape draw preview wireframe. */
export const SHAPE_DRAW_PREVIEW_USERDATA_KEY = 'isShapeDrawPreview';

/** Render order that keeps the preview above scene geometry. */
const SHAPE_DRAW_PREVIEW_RENDER_ORDER = 1000;

/** Scene members that host editor helper objects outside the world root. */
export interface ShapeDrawPreviewHost {
  addHelper(object: THREE.Object3D): void;
  removeHelper(object: THREE.Object3D): void;
}

/**
 * Orange wireframe box showing the brush a shape drag will create. It lives in
 * the helper scene, so it never reaches exports or the game preview.
 */
export class ShapeDrawPreview {
  private readonly host: ShapeDrawPreviewHost;
  private readonly wireframe: THREE.LineSegments;

  /**
   * Creates a hidden preview and adds it to the helper scene.
   *
   * @param host Helper scene host.
   */
  constructor(host: ShapeDrawPreviewHost) {
    this.host = host;
    this.wireframe = this.wireframeCreate();
    this.host.addHelper(this.wireframe);
  }

  /**
   * Returns the preview scene object.
   *
   * @returns Wireframe object.
   */
  previewObject(): THREE.Object3D {
    return this.wireframe;
  }

  /**
   * Shows the preview around a world box.
   *
   * @param worldBox Box to outline.
   */
  previewShow(worldBox: ShapeDrawWorldBox): void {
    this.wireframe.position.copy(worldBox.center);
    this.wireframe.quaternion.copy(worldBox.orientation);
    this.wireframe.scale.copy(worldBox.size);
    this.wireframe.visible = true;
    this.wireframe.updateMatrixWorld(true);
  }

  /** Removes the preview from the helper scene and frees its resources. */
  dispose(): void {
    this.host.removeHelper(this.wireframe);
    this.wireframe.geometry.dispose();
    const material = this.wireframe.material;
    if (material instanceof THREE.Material) {
      material.dispose();
    }
  }

  /**
   * Builds the unit-cube wireframe drawn on top of the scene.
   *
   * @returns Hidden wireframe.
   */
  private wireframeCreate(): THREE.LineSegments {
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(unitBox);
    unitBox.dispose();
    const material = new THREE.LineBasicMaterial({ color: Theme.selectionColor, depthTest: false, transparent: true });
    const wireframe = new THREE.LineSegments(edges, material);
    wireframe.name = 'shape_draw_preview';
    wireframe.renderOrder = SHAPE_DRAW_PREVIEW_RENDER_ORDER;
    wireframe.userData[SHAPE_DRAW_PREVIEW_USERDATA_KEY] = true;
    wireframe.visible = false;
    wireframe.frustumCulled = false;
    return wireframe;
  }
}
