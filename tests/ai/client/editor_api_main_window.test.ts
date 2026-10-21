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

  it('lists both tools in the MCP catalog', () => {
    expect(findMcpTool('get_main_window')).toBeDefined();
    expect(findMcpTool('set_main_window')).toBeDefined();
  });

  it('reads the arrangement of the main window', () => {
    const result = api.invokeTool('get_main_window');
    expect(result.ok).toBe(true);
    const state = result.data as unknown as ShellMainWindowState;
    expect(state.inspectorTab).toBe(docks.inspector.activeTabIdRead());
    expect(state.menus).toEqual(['File']);
  });

  it('switches the inspector tab and hides the info panel', () => {
    const result = api.invokeTool('set_main_window', { inspectorTab: 'entity', infoPanelVisible: false });
    expect(result.ok).toBe(true);
    const state = result.data as unknown as ShellMainWindowState;
    expect(state.inspectorTab).toBe('entity');
    expect(state.infoPanelVisible).toBe(false);
    expect(docks.inspector.activeTabIdRead()).toBe('entity');
    expect(docks.frame.isInfoPanelVisible()).toBe(false);
  });

  it('rejects unknown tabs and non boolean flags without changing anything', () => {
    const tabBefore = docks.inspector.activeTabIdRead();
    expect(api.invokeTool('set_main_window', { inspectorTab: 'textures' }).ok).toBe(false);
    expect(api.invokeTool('set_main_window', { toolbarVisible: 'no' }).ok).toBe(false);
    expect(docks.inspector.activeTabIdRead()).toBe(tabBefore);
    expect(docks.frame.isToolbarVisible()).toBe(true);
  });

  it('fails when the editor has no main window', () => {
    const headless = new EditorApi(editorApiTestHostCreate().host);
    expect(headless.invokeTool('get_main_window').ok).toBe(false);
  });
});
