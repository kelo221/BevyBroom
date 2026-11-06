import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { ShellMainWindowControl, type ShellMainWindowState } from '@/layout/shell/actions/shell_main_window_control.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import {
  shellTestDocksCreate,
  shellTestDocksDispose,
  type ShellTestDocks,
} from '../../layout/shell/shell_test_support.js';

/** Unit tests for the get_main_window and set_main_window MCP tools. */
describe('EditorApi main window tools', () => {
  let docks: ShellTestDocks;
  let menuBar: Toolbar;
  let api: EditorApi;

  beforeEach(() => {
    docks = shellTestDocksCreate();
    menuBar = new Toolbar(docks.frame.menuBarHostRead(), 'menubar');
    menuBar.addDropdown('File', []);
    const control = new ShellMainWindowControl({ ...docks, menuBar });
    api = new EditorApi(editorApiTestHostCreate({ mainWindowControlRead: () => control }).host);
  });

  afterEach(() => {
    menuBar.dispose();
    shellTestDocksDispose(docks);
  });

  it('lists both tools in the MCP catalog without an inspector tab argument', () => {
    expect(findMcpTool('get_main_window')).toBeDefined();
    const setTool = findMcpTool('set_main_window');
    expect(setTool).toBeDefined();
    const properties = (setTool?.inputSchema['properties'] ?? {}) as Record<string, unknown>;
    expect(Object.keys(properties)).not.toContain('inspectorTab');
    expect(Object.keys(properties)).toContain('inspectorVisible');
  });

  it('reads the arrangement of the main window', () => {
    const result = api.invokeTool('get_main_window');
    expect(result.ok).toBe(true);
    const state = result.data as unknown as ShellMainWindowState;
    expect(state.inspectorVisible).toBe(docks.frame.isInspectorVisible());
    expect(Object.keys(state)).not.toContain('inspectorTab');
    expect(state.menus).toEqual(['File']);
    expect(state.floatingWindows).toEqual({ texture_browser: false, entity_browser: false });
  });

  it('shows and hides a registered floating window', () => {
    let textureBrowserOpen = false;
    docks.dockCommands.floatingWindowRegister('texture_browser', {
      toggle: () => {
        textureBrowserOpen = !textureBrowserOpen;
      },
      isOpen: () => textureBrowserOpen,
    });
    const opened = api.invokeTool('set_main_window', { floatingWindows: { texture_browser: true } });
    expect(opened.ok).toBe(true);
    expect((opened.data as ShellMainWindowState).floatingWindows.texture_browser).toBe(true);
    expect(textureBrowserOpen).toBe(true);
    const closed = api.invokeTool('set_main_window', { floatingWindows: { texture_browser: false } });
    expect((closed.data as ShellMainWindowState).floatingWindows.texture_browser).toBe(false);
    expect(api.invokeTool('set_main_window', { floatingWindows: { face_edit: true } }).ok).toBe(false);
  });

  it('switches the info panel tab and hides the info panel', () => {
    const result = api.invokeTool('set_main_window', { infoPanelTab: 'issues', infoPanelVisible: false });
    expect(result.ok).toBe(true);
    const state = result.data as unknown as ShellMainWindowState;
    expect(state.infoPanelTab).toBe('issues');
    expect(state.infoPanelVisible).toBe(false);
    expect(docks.infoPanel.activeTabIdRead()).toBe('issues');
    expect(docks.frame.isInfoPanelVisible()).toBe(false);
  });

  it('rejects unknown info panel tabs and non boolean flags without changing anything', () => {
    const tabBefore = docks.infoPanel.activeTabIdRead();
    expect(api.invokeTool('set_main_window', { infoPanelTab: 'textures' }).ok).toBe(false);
    expect(api.invokeTool('set_main_window', { toolbarVisible: 'no' }).ok).toBe(false);
    expect(docks.infoPanel.activeTabIdRead()).toBe(tabBefore);
    expect(docks.frame.isToolbarVisible()).toBe(true);
  });

  it('fails when the editor has no main window', () => {
    const headless = new EditorApi(editorApiTestHostCreate().host);
    expect(headless.invokeTool('get_main_window').ok).toBe(false);
  });
});
