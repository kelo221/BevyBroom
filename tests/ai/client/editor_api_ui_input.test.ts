import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { MCP_UI_INPUT_TOOL_DEFINITIONS } from '@/ai/server/registry_mcp_tool_ui_input.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { ManagerInput } from '@/input/manager_input.js';
import { layoutWindowShortcutsRegister } from '@/layout/setup/layout_window_shortcut_bindings.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import { ObjectSelectContextMenu } from '@/tools/object_select/object_select_context_menu.js';
import { PanelCommandSearch } from '@/ui/command_search/panel_command_search.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { editorTestServicesCreate } from '../../editor/editor_test_services.js';
import {
  objectDragTestControllerRigCreate,
  objectDragTestMeshTopCenter,
  type ObjectDragTestControllerRig,
} from '../../tools/object_drag/object_drag_test_controller.js';

/** One row of a get_open_menus reply. */
interface UiInputTestRow {
  label: string;
  shortcut: string;
  enabled: boolean;
  path?: string;
  active?: boolean;
}

/** One menu of a get_open_menus reply. */
interface UiInputTestMenu {
  kind: string;
  rows: UiInputTestRow[];
  query?: string;
}

/**
 * Reads the open menus through the tool.
 *
 * @param api Editor API.
 * @returns Open menus.
 */
function uiInputTestMenusRead(api: EditorApi): UiInputTestMenu[] {
  const result = api.invokeTool('get_open_menus', {});
  expect(result.ok).toBe(true);
  return (result.data as { menus: UiInputTestMenu[] }).menus;
}

/**
 * Converts a world point into the `{x, y, z}` argument the tools take.
 *
 * @param point World point.
 * @returns Plain point object.
 */
function pointArg(point: THREE.Vector3): { x: number; y: number; z: number } {
  return { x: point.x, y: point.y, z: point.z };
}

/**
 * Returns the data of a successful tool result.
 *
 * @param result Tool result.
 * @returns Result data.
 */
function uiInputTestData<T>(result: McpToolResult): T {
  expect(result.ok, result.message).toBe(true);
  return result.data as T;
}

/**
 * Proves the keyboard and open menu tools drive the editor like a user: a right
 * viewport_click opens the right-click menu through the real input path,
 * get_open_menus reads its rows, choose_open_menu_item runs one, keyboard_input
 * presses the command search shortcut, types a query and runs the active result
 * with Enter, and invalid arguments fail clearly.
 */
describe('EditorApi keyboard and open menu tools', () => {
  let rig: ObjectDragTestControllerRig;
  let bridge: EditorInputBridge;
  let keyboardHandler: HandlerKeyboardShortcut;
  let contextMenu: ObjectSelectContextMenu;
  let commandSearch: PanelCommandSearch;
  let api: EditorApi;
  const duplicateRun = vi.fn();
  const subtractRun = vi.fn();

  /**
   * Builds the menu rows both the right-click menu and the command search use.
   *
   * @returns Menu entries.
   */
  function entriesBuild(): ToolbarMenuEntry[] {
    return [
      { label: 'Duplicate', onClick: duplicateRun, shortcut: 'Ctrl+D' },
      { kind: 'submenu', label: 'CSG', children: [{ label: 'Subtract', onClick: subtractRun }] },
      { label: 'Never Applies', onClick: vi.fn(), isEnabled: () => false },
    ];
  }

  beforeEach(() => {
    duplicateRun.mockClear();
    subtractRun.mockClear();
    rig = objectDragTestControllerRigCreate();
    document.body.appendChild(rig.testViewport.element);
    contextMenu = new ObjectSelectContextMenu({
      selectionManager: rig.selection,
      pickObjectStackAtClientPoint: (clientX, clientY) =>
        rig.testViewport.viewport.pickStackAtClientPoint(clientX, clientY),
      entriesBuild,
      isContextMenuAllowed: () => true,
    });
    const editor = new EditorWindow();
    editor.setServices(
      editorTestServicesCreate({
        objectContextMenuPressBegin: (clientX, clientY) => contextMenu.pressBegin(window, clientX, clientY),
      }),
    );
    editor.validateTools();
    editor.userSwitchToBoundsTool();
    bridge = new EditorInputBridge(editor);
    bridge.install(document.body);
    bridge.setExclusiveViewportRoots([rig.testViewport.element]);
    commandSearch = new PanelCommandSearch(document, () => [{ label: 'Edit', entriesBuild }]);
    keyboardHandler = new HandlerKeyboardShortcut(new ManagerInput(), () => createDefaultKeyboardShortcutSettings());
    layoutWindowShortcutsRegister(keyboardHandler, { command_search: () => commandSearch.open() });
    keyboardHandler.register();
    const { host } = editorApiTestHostCreate({
      worldObject: rig.world,
      selectionManager: rig.selection,
      viewportsInteractiveRead: () => [rig.testViewport.source],
    });
    api = new EditorApi(host);
  });

  afterEach(() => {
    keyboardHandler.unregister();
    commandSearch.close();
    contextMenu.dispose();
    bridge.uninstall();
    rig.controller.dispose();
    document.body.replaceChildren();
  });

  it('opens the right-click menu with a right viewport_click, reads its rows and runs a chosen row', () => {
    const [mesh] = rig.meshes;
    if (!mesh) {
      throw new Error('The rig must hold a mesh');
    }
    const clicked = api.invokeTool('viewport_click', {
      view: 'perspective',
      at: pointArg(objectDragTestMeshTopCenter(mesh)),
      button: 'right',
    });
    expect(clicked.ok).toBe(true);
    expect(rig.selection.isObjectSelected(mesh)).toBe(true);
    const [menu] = uiInputTestMenusRead(api);
    expect(menu?.kind).toBe('menu');
    expect(menu?.rows.map((row) => row.label)).toEqual(['Duplicate', 'CSG']);
    expect(menu?.rows[0]).toEqual({ label: 'Duplicate', shortcut: 'Ctrl+D', enabled: true });
    const chosen = uiInputTestData<{ menus: UiInputTestMenu[] }>(
      api.invokeTool('choose_open_menu_item', { label: 'Duplicate' }),
    );
    expect(duplicateRun).toHaveBeenCalledOnce();
    expect(chosen.menus).toEqual([]);
  });

  it('opens the command search from its shortcut, types a query and runs the active result with Enter', () => {
    const pressed = uiInputTestData<{ handled: boolean; focused: { tag: string; label: string | null } }>(
      api.invokeTool('keyboard_input', { code: 'KeyP', keys: { ctrl: true, shift: true } }),
    );
    expect(pressed.handled).toBe(true);
    expect(pressed.focused).toEqual({ tag: 'input', label: 'Search commands' });
    const typed = uiInputTestData<{ value: string }>(api.invokeTool('keyboard_input', { text: 'subtr' }));
    expect(typed.value).toBe('subtr');
    const [search] = uiInputTestMenusRead(api);
    expect(search).toEqual({
      kind: 'command_search',
      query: 'subtr',
      rows: [{ label: 'Subtract', shortcut: '', enabled: true, path: 'Edit \u203a CSG', active: true }],
    });
    api.invokeTool('keyboard_input', { code: 'Enter' });
    expect(subtractRun).toHaveBeenCalledOnce();
    expect(uiInputTestMenusRead(api)).toEqual([]);
  });

  it('fails clearly for invalid arguments', () => {
    expect(api.invokeTool('keyboard_input', {}).ok).toBe(false);
    expect(api.invokeTool('keyboard_input', { code: 'KeyA', text: 'a' }).ok).toBe(false);
    expect(api.invokeTool('keyboard_input', { code: 'KeyA', keys: { ctrl: 'yes' } }).ok).toBe(false);
    expect(api.invokeTool('keyboard_input', { text: 'no field has focus' }).ok).toBe(false);
    expect(api.invokeTool('choose_open_menu_item', { label: 'Duplicate' }).ok).toBe(false);
    expect(
      api.invokeTool('viewport_click', { view: 'perspective', at: { x: 0, y: 0, z: 0 }, button: 'middle' }).ok,
    ).toBe(false);
  });

  it('publishes the tools with their required arguments', () => {
    const required = Object.fromEntries(
      MCP_UI_INPUT_TOOL_DEFINITIONS.map((definition) => [definition.name, definition.inputSchema['required']]),
    );
    expect(Object.keys(required)).toEqual(['keyboard_input', 'get_open_menus', 'choose_open_menu_item']);
    expect(required['choose_open_menu_item']).toEqual(['label']);
  });
});
