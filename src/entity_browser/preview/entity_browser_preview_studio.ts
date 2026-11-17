import type * as THREE from 'three';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserPreviewOrbit } from '@/entity_browser/preview/entity_browser_preview_orbit.js';
import type {
  EntityBrowserPreviewRenderer,
  EntityBrowserPreviewRendererFactory,
} from '@/entity_browser/preview/entity_browser_preview_renderer.js';
import { EntityBrowserPreviewStage } from '@/entity_browser/preview/entity_browser_preview_stage.js';

/**
 * Edge length of the tile images, in pixels: twice the tile size for sharp
 * high-density screens.
 */
export const ENTITY_BROWSER_PREVIEW_IMAGE_PX = 112;

/**
 * Builds, caches and draws the 3D previews of catalog entries: one preview
 * object per entry, one tile image per entry and the live single tile view. The
 * renderer is created on first use, so browsers showing icons never open a 3D
 * context.
 */
export class EntityBrowserPreviewStudio {
  readonly stage = new EntityBrowserPreviewStage();
  private readonly ownerDocument: Document;
  private readonly rendererFactory: EntityBrowserPreviewRendererFactory;
  private readonly subjects = new Map<string, THREE.Object3D | null>();
  private readonly imageUrls = new Map<string, string | null>();
  private readonly imageOrbit = new EntityBrowserPreviewOrbit();
  private renderer: EntityBrowserPreviewRenderer | null = null;
  private isRendererResolved = false;

  /**
   * Creates an empty studio.
   *
   * @param ownerDocument Document that owns the renderer canvas.
   * @param rendererFactory Creates the renderer on first use.
   */
  constructor(ownerDocument: Document, rendererFactory: EntityBrowserPreviewRendererFactory) {
    this.ownerDocument = ownerDocument;
    this.rendererFactory = rendererFactory;
  }

  /**
   * Returns the renderer, creating it on first use.
   *
   * @returns Renderer, or null when 3D drawing is unavailable.
   */
  rendererRead(): EntityBrowserPreviewRenderer | null {
    if (!this.isRendererResolved) {
      this.isRendererResolved = true;
      this.renderer = this.rendererFactory(this.ownerDocument);
    }
    return this.renderer;
  }

  /**
   * Returns the preview object of an entry, building it on first use.
   *
   * @param entry Catalog entry.
   * @returns Preview object, or null when the entry has none or building
   *   failed.
   */
  subjectResolve(entry: EntityBrowserCatalogEntry): THREE.Object3D | null {
    if (!this.subjects.has(entry.id)) {
      this.subjects.set(entry.id, EntityBrowserPreviewStudio.subjectBuild(entry));
    }
    return this.subjects.get(entry.id) ?? null;
  }

  /**
   * Returns the tile image of an entry, drawing it on first use.
   *
   * @param entry Catalog entry.
   * @returns Image data URL, or null when the entry has no preview or nothing
   *   can draw it.
   */
  imageUrlResolve(entry: EntityBrowserCatalogEntry): string | null {
    if (!this.imageUrls.has(entry.id)) {
      this.imageUrls.set(entry.id, this.imageDraw(entry));
    }
    return this.imageUrls.get(entry.id) ?? null;
  }

  /**
   * Draws an entry into the live canvas from an orbit view.
   *
   * @param entry Catalog entry, or null for an empty studio.
   * @param orbit Orbit angles and zoom.
   * @param widthPx CSS width of the canvas.
   * @param heightPx CSS height of the canvas.
   * @returns True when the canvas was drawn.
   */
  liveDraw(
    entry: EntityBrowserCatalogEntry | null,
    orbit: EntityBrowserPreviewOrbit,
    widthPx: number,
    heightPx: number,
  ): boolean {
    const renderer = this.rendererRead();
    if (renderer === null || widthPx <= 0 || heightPx <= 0) {
      return false;
    }
    this.stage.subjectShow(entry === null ? null : this.subjectResolve(entry));
    this.stage.cameraPlace(orbit, widthPx / heightPx);
    renderer.renderToCanvas(this.stage.scene, this.stage.camera, widthPx, heightPx);
    return true;
  }

  /**
   * Forgets every preview object and tile image so they are rebuilt from the
   * current kinds.
   */
  cacheClear(): void {
    this.subjects.clear();
    this.imageUrls.clear();
    this.stage.subjectShow(null);
  }

  /** Frees the renderer and the caches. */
  dispose(): void {
    this.cacheClear();
    this.renderer?.dispose();
    this.renderer = null;
  }

  /**
   * Draws the tile image of an entry from the fresh three-quarter view.
   *
   * @param entry Catalog entry.
   * @returns Image data URL, or null when there is nothing to draw.
   */
  private imageDraw(entry: EntityBrowserCatalogEntry): string | null {
    const subject = this.subjectResolve(entry);
    const renderer = subject === null ? null : this.rendererRead();
    if (renderer === null) {
      return null;
    }
    this.stage.subjectShow(subject);
    this.stage.cameraPlace(this.imageOrbit, 1);
    return renderer.renderToImageUrl(this.stage.scene, this.stage.camera, ENTITY_BROWSER_PREVIEW_IMAGE_PX);
  }

  /**
   * Builds the preview object of an entry.
   *
   * @param entry Catalog entry.
   * @returns Preview object, or null when the entry has none or its factory
   *   failed.
   */
  private static subjectBuild(entry: EntityBrowserCatalogEntry): THREE.Object3D | null {
    if (entry.previewCreate === null) {
      return null;
    }
    try {
      return entry.previewCreate();
    } catch {
      return null;
    }
  }
}
