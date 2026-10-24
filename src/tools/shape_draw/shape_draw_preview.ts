import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { shapeDrawPreviewSegmentsCreate } from './shape_draw_preview_edges.js';

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
 * Orange wireframe showing the brushes a shape drag will create. It lives in
 * the helper scene, so it never reaches exports or the game preview.
 */
export class ShapeDrawPreview {
  private readonly host: ShapeDrawPreviewHost;
  private readonly wireframe: THREE.LineSegments;
  private segmentCapacity: number;

  /**
   * Creates a hidden preview and adds it to the helper scene.
   *
   * @param host Helper scene host.
   */
  constructor(host: ShapeDrawPreviewHost) {
    this.host = host;
    this.segmentCapacity = 0;
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
   * Shows the preview wireframe of the shape pieces in world coordinates.
   *
   * @param worldPieces Convex point sets in world coordinates.
   */
  previewShowWorldPieces(worldPieces: readonly THREE.Vector3[][]): void {
    const segments = shapeDrawPreviewSegmentsCreate(worldPieces);
    this.segmentsBufferEnsure(segments);
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
   * Writes the segment endpoints into the geometry, reallocating it only when
   * the piece count changed.
   *
   * @param segments Flat segment endpoint coordinates.
   */
  private segmentsBufferEnsure(segments: Float32Array): void {
    if (segments.length !== this.segmentCapacity) {
      this.wireframe.geometry.dispose();
      this.wireframe.geometry = new THREE.BufferGeometry();
      this.wireframe.geometry.setAttribute('position', new THREE.BufferAttribute(segments, 3));
      this.segmentCapacity = segments.length;
      return;
    }
    const attribute = this.wireframe.geometry.getAttribute('position');
    if (attribute instanceof THREE.BufferAttribute) {
      attribute.array.set(segments);
      attribute.needsUpdate = true;
    }
  }

  /**
   * Builds the hidden wireframe drawn on top of the scene.
   *
   * @returns Hidden wireframe.
   */
  private wireframeCreate(): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    const material = new THREE.LineBasicMaterial({ color: Theme.selectionColor, depthTest: false, transparent: true });
    const wireframe = new THREE.LineSegments(geometry, material);
    wireframe.name = 'shape_draw_preview';
    wireframe.renderOrder = SHAPE_DRAW_PREVIEW_RENDER_ORDER;
    wireframe.userData[SHAPE_DRAW_PREVIEW_USERDATA_KEY] = true;
    wireframe.visible = false;
    wireframe.frustumCulled = false;
    return wireframe;
  }
}
