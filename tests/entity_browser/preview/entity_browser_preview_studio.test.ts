import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserPreviewOrbit } from '@/entity_browser/preview/entity_browser_preview_orbit.js';
import {
  ENTITY_BROWSER_PREVIEW_IMAGE_PX,
  EntityBrowserPreviewStudio,
} from '@/entity_browser/preview/entity_browser_preview_studio.js';
import {
  entityBrowserTestEntryCreate,
  entityBrowserTestPreviewRendererCreate,
} from '../entity_browser_test_support.js';

/**
 * Creates a catalog entry whose preview is a box of the given size.
 *
 * @param id Entry id.
 * @param boxSize Edge length of the preview box.
 * @returns Entry and the spy building its preview.
 */
function entryWithBoxPreview(
  id: string,
  boxSize: number,
): {
  entry: EntityBrowserCatalogEntry;
  previewCreate: ReturnType<typeof vi.fn<() => THREE.Object3D>>;
} {
  const previewCreate = vi.fn(
    () => new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, boxSize), new THREE.MeshBasicMaterial()),
  );
  return { entry: { ...entityBrowserTestEntryCreate(id, id, 'Test', 0, 0), previewCreate }, previewCreate };
}

/**
 * The preview studio builds each kind's preview object once, draws one tile
 * image per kind, draws the live view framed on the kind, and opens no 3D
 * context until something is drawn.
 */
describe('EntityBrowserPreviewStudio', () => {
  it('creates no renderer until a preview is drawn', () => {
    const rendererFactory = vi.fn(() => entityBrowserTestPreviewRendererCreate());
    const studio = new EntityBrowserPreviewStudio(document, rendererFactory);
    studio.imageUrlResolve(entityBrowserTestEntryCreate('icon_only', 'Icon Only', 'Test', 0, 0));
    expect(rendererFactory).not.toHaveBeenCalled();
    studio.imageUrlResolve(entryWithBoxPreview('box', 1).entry);
    expect(rendererFactory).toHaveBeenCalledTimes(1);
  });

  it('draws each tile image once at the image size and rebuilds after the cache is cleared', () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const studio = new EntityBrowserPreviewStudio(document, () => renderer);
    const { entry, previewCreate } = entryWithBoxPreview('box', 1);
    const firstUrl = studio.imageUrlResolve(entry);
    expect(firstUrl).not.toBeNull();
    expect(studio.imageUrlResolve(entry)).toBe(firstUrl);
    expect(renderer.renderToImageUrl).toHaveBeenCalledTimes(1);
    expect(renderer.renderToImageUrl.mock.calls[0]?.[2]).toBe(ENTITY_BROWSER_PREVIEW_IMAGE_PX);
    studio.cacheClear();
    expect(studio.imageUrlResolve(entry)).not.toBe(firstUrl);
    expect(previewCreate).toHaveBeenCalledTimes(2);
  });

  it('shows the icon for kinds without a preview, a failing preview or no 3D support', () => {
    const studio = new EntityBrowserPreviewStudio(document, () => entityBrowserTestPreviewRendererCreate());
    const failing = {
      ...entityBrowserTestEntryCreate('failing', 'Failing', 'Test', 0, 0),
      previewCreate: () => {
        throw new Error('no preview');
      },
    };
    expect(studio.imageUrlResolve(entityBrowserTestEntryCreate('icon_only', 'Icon', 'Test', 0, 0))).toBeNull();
    expect(studio.imageUrlResolve(failing)).toBeNull();
    const studioWithout3d = new EntityBrowserPreviewStudio(document, () => null);
    expect(studioWithout3d.imageUrlResolve(entryWithBoxPreview('box', 1).entry)).toBeNull();
  });

  it('frames the live view on the shown kind whatever its size', () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const studio = new EntityBrowserPreviewStudio(document, () => renderer);
    const orbit = new EntityBrowserPreviewOrbit();
    const distances = [0.2, 9].map((boxSize) => {
      const { entry } = entryWithBoxPreview(`box_${boxSize}`, boxSize);
      expect(studio.liveDraw(entry, orbit, 300, 200)).toBe(true);
      const bounds = new THREE.Box3().setFromObject(studio.subjectResolve(entry) ?? new THREE.Object3D());
      expect(bounds.containsPoint(studio.stage.subjectBoundsRead().center)).toBe(true);
      expect(studio.stage.subjectRead()).toBe(studio.subjectResolve(entry));
      return studio.stage.camera.position.distanceTo(studio.stage.subjectBoundsRead().center) / boxSize;
    });
    expect(distances[0]).toBeCloseTo(distances[1] ?? 0, 5);
    expect(renderer.renderToCanvas).toHaveBeenLastCalledWith(studio.stage.scene, studio.stage.camera, 300, 200);
  });

  it('frees the renderer when disposed', () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const studio = new EntityBrowserPreviewStudio(document, () => renderer);
    studio.imageUrlResolve(entryWithBoxPreview('box', 1).entry);
    studio.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(studio.stage.subjectRead()).toBeNull();
  });
});
