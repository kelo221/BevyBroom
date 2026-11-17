import type * as THREE from 'three';
import type { EditorApiHost, EditorApiViewportView } from './editor_api_host.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { pointerClientPointOfWorld, type PointerClientPoint } from '@/utils/pointer_client_project.js';

/** View names the pointer tools accept. */
export const EDITOR_API_VIEWPORT_VIEW_NAMES: readonly string[] = [
  ViewportKind.PERSPECTIVE,
  ViewportKind.TOP,
  ViewportKind.FRONT,
  ViewportKind.SIDE,
];

/**
 * Finds the first interactive viewport of a kind that is visible on screen.
 *
 * @param host Editor host listing the interactive viewports.
 * @param view View name such as "perspective" or "top".
 * @returns Visible viewport, or null when none of that kind is visible.
 */
export function editorApiVisibleViewportFind(host: EditorApiHost, view: string): EditorApiViewportView | null {
  const viewports = host.viewportsInteractiveRead?.() ?? [];
  for (const viewport of viewports) {
    if (viewport.getViewportKind() !== view) {
      continue;
    }
    const rect = viewport.getContentElement().getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return viewport;
    }
  }
  return null;
}

/**
 * Returns the client point where a world point shows in a viewport.
 *
 * @param viewport Viewport showing the point.
 * @param worldPoint World point.
 * @returns Client point.
 */
export function editorApiViewportClientPointOf(
  viewport: EditorApiViewportView,
  worldPoint: THREE.Vector3,
): PointerClientPoint {
  return pointerClientPointOfWorld(worldPoint, viewport.getCamera(), viewport.getContentElement());
}
