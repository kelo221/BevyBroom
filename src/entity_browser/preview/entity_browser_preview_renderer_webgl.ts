import * as THREE from 'three';
import { markWebGLContextLossAsIntentional } from '@/viewports/webgl/webgl_context_diagnostics.js';
import { createEditorWebGLCanvas, getEditorWebGLRendererOptions } from '@/viewports/webgl/webgl_renderer_options.js';
import type { EntityBrowserPreviewRenderer } from '@/entity_browser/preview/entity_browser_preview_renderer.js';

/** Name the preview canvas reports in WebGL diagnostics. */
const ENTITY_BROWSER_PREVIEW_RENDERER_OWNER = 'entity_browser_preview';

/** Highest device pixel ratio the live preview draws at. */
const ENTITY_BROWSER_PREVIEW_PIXEL_RATIO_MAX = 2;

/** Multisample count of the offscreen image target. */
const ENTITY_BROWSER_PREVIEW_IMAGE_SAMPLES = 4;

/**
 * WebGL preview renderer: one context per browser. Images are drawn into an
 * offscreen target and read back, so making tile images never disturbs the live
 * canvas.
 */
export class EntityBrowserPreviewRendererWebgl implements EntityBrowserPreviewRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ownerDocument: Document;
  private imageTarget: THREE.WebGLRenderTarget | null = null;

  /**
   * Creates the WebGL context on a new canvas.
   *
   * @param ownerDocument Document that owns the canvas.
   */
  constructor(ownerDocument: Document) {
    this.ownerDocument = ownerDocument;
    this.canvas = createEditorWebGLCanvas(ENTITY_BROWSER_PREVIEW_RENDERER_OWNER, ownerDocument);
    this.renderer = new THREE.WebGLRenderer({
      ...getEditorWebGLRendererOptions({ antialias: true }),
      canvas: this.canvas,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const devicePixelRatio = ownerDocument.defaultView?.devicePixelRatio ?? 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, ENTITY_BROWSER_PREVIEW_PIXEL_RATIO_MAX));
  }

  /**
   * Creates a WebGL preview renderer when the document's window supports WebGL
   * 2.
   *
   * @param ownerDocument Document that owns the canvas.
   * @returns Renderer, or null when WebGL is unavailable.
   */
  static create(ownerDocument: Document): EntityBrowserPreviewRendererWebgl | null {
    const ownerWindow = ownerDocument.defaultView as (Window & { WebGL2RenderingContext?: unknown }) | null;
    if (ownerWindow?.WebGL2RenderingContext === undefined) {
      return null;
    }
    try {
      return new EntityBrowserPreviewRendererWebgl(ownerDocument);
    } catch {
      return null;
    }
  }

  /**
   * Draws a scene into the live canvas at the given CSS size.
   *
   * @param scene Preview scene.
   * @param camera Camera looking at the subject.
   * @param widthPx CSS width of the canvas.
   * @param heightPx CSS height of the canvas.
   */
  renderToCanvas(scene: THREE.Scene, camera: THREE.Camera, widthPx: number, heightPx: number): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== widthPx || size.y !== heightPx) {
      this.renderer.setSize(widthPx, heightPx, false);
    }
    this.renderer.setRenderTarget(null);
    this.renderer.render(scene, camera);
  }

  /**
   * Draws a scene once into a square image without touching the live canvas.
   *
   * @param scene Preview scene.
   * @param camera Camera looking at the subject.
   * @param sizePx Edge length of the image in pixels.
   * @returns PNG data URL, or null when the image could not be made.
   */
  renderToImageUrl(scene: THREE.Scene, camera: THREE.Camera, sizePx: number): string | null {
    const target = this.imageTargetEnsure(sizePx);
    this.renderer.setRenderTarget(target);
    this.renderer.render(scene, camera);
    const pixels = new Uint8Array(sizePx * sizePx * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, sizePx, sizePx, pixels);
    this.renderer.setRenderTarget(null);
    return this.pixelsToImageUrl(pixels, sizePx);
  }

  /** Frees the GPU resources and removes the canvas. */
  dispose(): void {
    this.imageTarget?.dispose();
    this.imageTarget = null;
    markWebGLContextLossAsIntentional(this.canvas);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  /**
   * Returns the offscreen image target, recreating it when the size changed.
   *
   * @param sizePx Edge length in pixels.
   * @returns Render target in sRGB.
   */
  private imageTargetEnsure(sizePx: number): THREE.WebGLRenderTarget {
    if (this.imageTarget !== null && this.imageTarget.width === sizePx) {
      return this.imageTarget;
    }
    this.imageTarget?.dispose();
    this.imageTarget = new THREE.WebGLRenderTarget(sizePx, sizePx, { samples: ENTITY_BROWSER_PREVIEW_IMAGE_SAMPLES });
    this.imageTarget.texture.colorSpace = THREE.SRGBColorSpace;
    return this.imageTarget;
  }

  /**
   * Turns bottom-up RGBA pixels into a PNG data URL.
   *
   * @param pixels RGBA pixels with the bottom row first.
   * @param sizePx Edge length in pixels.
   * @returns PNG data URL, or null when no 2D canvas is available.
   */
  private pixelsToImageUrl(pixels: Uint8Array, sizePx: number): string | null {
    const imageCanvas = this.ownerDocument.createElement('canvas');
    imageCanvas.width = sizePx;
    imageCanvas.height = sizePx;
    const context = imageCanvas.getContext('2d');
    if (context === null) {
      return null;
    }
    const imageData = context.createImageData(sizePx, sizePx);
    const rowBytes = sizePx * 4;
    for (let row = 0; row < sizePx; row++) {
      imageData.data.set(pixels.subarray(row * rowBytes, (row + 1) * rowBytes), (sizePx - 1 - row) * rowBytes);
    }
    context.putImageData(imageData, 0, 0);
    return imageCanvas.toDataURL('image/png');
  }
}
