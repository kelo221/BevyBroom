import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { EditorApiViewportView } from '@/ai/client/editor_api_host.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { entityHandleTestViewsCreate } from '../../entity/handles/entity_handle_test_views.js';

/** Pixel size of the fake view. */
const PANE_PIXELS = 400;

/** One handle of a get_entity_handles reply. */
interface EntityHandlesTestHandle {
  name: string;
  position: { x: number; y: number; z: number };
  arrows: { direction: { x: number; y: number; z: number }; tip: { x: number; y: number; z: number } }[];
}

/**
 * Builds an EditorApi whose only view is a front view looking at a point.
 *
 * @param target Point the view looks at.
 * @returns The API.
 */
function apiWithFrontView(target: THREE.Vector3): EditorApi {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(0, 0, PANE_PIXELS, PANE_PIXELS);
  const camera =
    entityHandleTestViewsCreate(target).find((view) => view.name === 'front')?.camera ?? new THREE.Camera();
  const viewport: EditorApiViewportView = {
    getViewportKind: () => ViewportKind.FRONT,
    getContentElement: () => element,
    getCamera: () => camera,
  };
  return new EditorApi(editorApiTestHostCreate({ viewportsInteractiveRead: () => [viewport] }).host);
}

/**
 * Get_entity_handles reports the balls and the arrows a view lets the user
 * grab.
 */
describe('EditorApi get_entity_handles', () => {
  it('lists the six face handles of a box with only the arrows the front view shows', () => {
    const api = apiWithFrontView(new THREE.Vector3(0, 0.5, 0));
    const added = api.invokeTool('add_procedural', { position: { x: 0, y: 0, z: 0 } });
    const id = String((added.data as { id: string }).id);
    const result = api.invokeTool('get_entity_handles', { id, view: 'front' });
    expect(result.ok).toBe(true);
    const handles = (result.data as { handles: EntityHandlesTestHandle[] }).handles;
    expect(handles).toHaveLength(6);
    const top = handles.find((handle) => handle.name.endsWith('max_y'));
    const front = handles.find((handle) => handle.name.endsWith('max_z'));
    expect(top?.arrows).toHaveLength(1);
    expect(top?.arrows[0]?.direction).toEqual({ x: 0, y: 1, z: 0 });
    expect((top?.arrows[0]?.tip.y ?? 0) - (top?.position.y ?? 0)).toBeGreaterThan(0);
    expect(front?.arrows).toEqual([]);
  });

  it('fails for an unknown entity or a view that is not shown', () => {
    const api = apiWithFrontView(new THREE.Vector3());
    expect(api.invokeTool('get_entity_handles', { id: 'missing', view: 'front' }).ok).toBe(false);
    const added = api.invokeTool('add_procedural', {});
    const id = String((added.data as { id: string }).id);
    expect(api.invokeTool('get_entity_handles', { id, view: 'top' }).ok).toBe(false);
  });
});
