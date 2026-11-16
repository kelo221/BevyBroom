import type * as THREE from 'three';

/** Draws entity browser previews, live into a canvas or once into an image. */
export interface EntityBrowserPreviewRenderer {
  /** Canvas the live single tile view draws into. */
  readonly canvas: HTMLCanvasElement;
  /**
   * Draws a scene into the live canvas at the given CSS size.
   *
   * @param scene Preview scene.
   * @param camera Camera looking at the subject.
   * @param widthPx CSS width of the canvas.
   * @param heightPx CSS height of the canvas.
   */
  renderToCanvas(scene: THREE.Scene, camera: THREE.Camera, widthPx: number, heightPx: number): void;
  /**
   * Draws a scene once into a square image without touching the live canvas.
   *
   * @param scene Preview scene.
   * @param camera Camera looking at the subject.
   * @param sizePx Edge length of the image in pixels.
   * @returns Image data URL, or null when the image could not be made.
   */
  renderToImageUrl(scene: THREE.Scene, camera: THREE.Camera, sizePx: number): string | null;
  /** Frees the GPU resources and the canvas. */
  dispose(): void;
}

/**
 * Creates the preview renderer of a browser.
 *
 * @param ownerDocument Document that owns the canvas.
 * @returns Renderer, or null when 3D drawing is unavailable.
 */
export type EntityBrowserPreviewRendererFactory = (ownerDocument: Document) => EntityBrowserPreviewRenderer | null;
