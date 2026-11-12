import { SHELL_FLOATING_WINDOW_IDS } from '@/layout/shell/actions/shell_floating_window.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { ShellMainWindowControl, type ShellMainWindowState } from '@/layout/shell/actions/shell_main_window_control.js';
import type { ShellMainWindowLayout } from '@/layout/shell/actions/shell_main_window_layout.js';
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
    expect(state.floatingWindows).toEqual(
      Object.fromEntries(SHELL_FLOATING_WINDOW_IDS.map((windowId) => [windowId, false])),
    );
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

  it('folds and unfolds the info panel and reports it', () => {
    expect((api.invokeTool('get_main_window').data as ShellMainWindowState).infoPanelCollapsed).toBe(true);
    const unfolded = api.invokeTool('set_main_window', { infoPanelCollapsed: false });
    expect(unfolded.ok).toBe(true);
    expect((unfolded.data as ShellMainWindowState).infoPanelCollapsed).toBe(false);
    expect(docks.frame.isInfoPanelCollapsed()).toBe(false);
    expect(docks.infoPanel.isCollapsedShown()).toBe(false);
    expect(api.invokeTool('set_main_window', { infoPanelCollapsed: 'yes' }).ok).toBe(false);
    expect(docks.frame.isInfoPanelCollapsed()).toBe(false);
  });

  it('reads the bounds of the views, the info panel and the inspector', () => {
    expect(findMcpTool('get_shell_layout')).toBeDefined();
    const result = api.invokeTool('get_shell_layout');
    expect(result.ok).toBe(true);
    const layout = result.data as unknown as ShellMainWindowLayout;
    (['views', 'infoPanel', 'inspector'] as const).forEach((area) => {
      expect(Object.keys(layout[area]).sort()).toEqual(['height', 'width', 'x', 'y']);
      Object.values(layout[area]).forEach((value) => expect(Number.isFinite(value)).toBe(true));
    });
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
