import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { EditorWindow } from '@/editor/window/editor_window.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { clipboardControllerActive } from '@/clipboard/controller/clipboard_controller_active.js';
import {
  LayoutClipboardSystem,
  layoutClipboardViewportPointRead,
  type LayoutClipboardSource,
} from '@/layout/setup/layout_clipboard_setup.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';

/**
 * Builds layout parts over a fresh world with a selected light.
 *
 * @returns Clipboard source and the light.
 */
function sourceWithSelectedLightCreate(): { source: LayoutClipboardSource; light: THREE.Object3D } {
  const world = new THREE.Group();
  const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
  world.add(light);
  const selectionManager = new ManagerSelection();
  selectionManager.setSelection(selectionMeshesFromHierarchyCollect([light]), [light]);
  const source: LayoutClipboardSource = {
    worldObject: world,
    commandStack: new CommandStack(16),
    selectionManager,
    solidModelControllerRead: () => null,
    editorWindowRead: () => null,
    hierarchyObjectsDelete: vi.fn(),
    gridIntervalRead: () => 0,
    refreshAfterWorldMutation: vi.fn(),
    showStatusMessage: vi.fn(),
  };
  return { source, light };
}

/**
 * Builds an editor window stand-in that saw the pointer at a client point over
 * a view.
 *
 * @param camera Camera of the view under the pointer, or null when no view is
 *   there.
 * @returns Editor window stand-in.
 */
function editorWindowAtPointerCreate(camera: THREE.Camera | null): EditorWindow {
  const pickElement = document.createElement('div');
  const services = {
    getLastPointerClientPosition: () => null,
    resolveInteractiveViewportAtClientPoint: () => (camera === null ? null : { camera, pickElement }),
  };
  return {
    getServices: () => services,
    hasLastPointerClient: true,
    lastPointerClientX: 40,
    lastPointerClientY: 25,
    lastPointerOwnerDocument: document,
  } as unknown as EditorWindow;
}

/**
 * The main window clipboard: document events, menu commands and the MCP
 * controller.
 */
describe('LayoutClipboardSystem', () => {
  const systems: LayoutClipboardSystem[] = [];

  afterEach(() => {
    systems.splice(0).forEach((system) => system.dispose());
  });

  it('copies the selection on the document copy event and becomes the MCP controller', () => {
    const { source } = sourceWithSelectedLightCreate();
    const system = new LayoutClipboardSystem(source, document);
    systems.push(system);
    expect(clipboardControllerActive.controllerRead()).toBe(system.controller);
    const event = new Event('copy', { bubbles: true, cancelable: true });
    const setData = vi.fn();
    Object.defineProperty(event, 'clipboardData', { value: { setData, getData: () => '' } });
    document.body.dispatchEvent(event);
    expect(setData).toHaveBeenCalledWith('text/plain', system.controller.lastCopiedTextRead());
    expect(event.defaultPrevented).toBe(true);
  });

  it('stops listening and releases the MCP controller when disposed', () => {
    const { source } = sourceWithSelectedLightCreate();
    const system = new LayoutClipboardSystem(source, document);
    system.dispose();
    expect(clipboardControllerActive.controllerRead()).toBeNull();
    const event = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { setData: vi.fn(), getData: () => '' } });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('reads the view and pointer the editor window saw last', () => {
    const camera = new THREE.PerspectiveCamera();
    const point = layoutClipboardViewportPointRead(editorWindowAtPointerCreate(camera));
    expect(point?.camera).toBe(camera);
    expect(point?.clientX).toBe(40);
    expect(point?.clientY).toBe(25);
    expect(layoutClipboardViewportPointRead(editorWindowAtPointerCreate(null))).toBeNull();
    expect(layoutClipboardViewportPointRead(null)).toBeNull();
  });
});
