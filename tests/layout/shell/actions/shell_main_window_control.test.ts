import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { ShellMainWindowControl } from '@/layout/shell/actions/shell_main_window_control.js';
import { shellTestDocksCreate, shellTestDocksDispose, type ShellTestDocks } from '../shell_test_support.js';

/** Menu titles the test menu bar shows. */
const SHELL_MAIN_WINDOW_TEST_MENUS = ['File', 'Edit', 'View'];

/**
 * Creates a menu bar with one empty menu per title.
 *
 * @param docks Docks whose frame hosts the menu bar.
 * @returns Menu bar.
 */
function menuBarCreate(docks: ShellTestDocks): Toolbar {
  const menuBar = new Toolbar(docks.frame.menuBarHostRead(), 'menubar');
  SHELL_MAIN_WINDOW_TEST_MENUS.forEach((title) => menuBar.addDropdown(title, []));
  return menuBar;
}

describe('ShellMainWindowControl', () => {
  let docks: ShellTestDocks;
  let menuBar: Toolbar;
  let control: ShellMainWindowControl;

  beforeEach(() => {
    docks = shellTestDocksCreate();
    menuBar = menuBarCreate(docks);
    control = new ShellMainWindowControl({ ...docks, menuBar });
  });

  afterEach(() => {
    menuBar.dispose();
    shellTestDocksDispose(docks);
  });

  it('reads the shown docks, tabs and menu titles', () => {
    const state = control.stateRead();
    expect(state.inspectorVisible).toBe(docks.frame.isInspectorVisible());
    expect(state.inspectorTab).toBe(docks.inspector.activeTabIdRead());
    expect(state.infoPanelVisible).toBe(docks.frame.isInfoPanelVisible());
    expect(state.infoPanelTab).toBe(docks.infoPanel.activeTabIdRead());
    expect(state.toolbarVisible).toBe(docks.frame.isToolbarVisible());
    expect(state.menus).toEqual(SHELL_MAIN_WINDOW_TEST_MENUS);
  });

  it('switches tabs and hides docks, leaving omitted fields alone', () => {
    const before = control.stateRead();
    const after = control.changesApply({ inspectorTab: 'face', infoPanelTab: 'issues', infoPanelVisible: false });
    expect(after.inspectorTab).toBe('face');
    expect(docks.inspector.activeTabIdRead()).toBe('face');
    expect(after.infoPanelTab).toBe('issues');
    expect(after.infoPanelVisible).toBe(false);
    expect(docks.frame.isInfoPanelVisible()).toBe(false);
    expect(after.inspectorVisible).toBe(before.inspectorVisible);
    expect(after.toolbarVisible).toBe(before.toolbarVisible);
  });

  it('shows hidden bars again', () => {
    control.changesApply({ inspectorVisible: false, toolbarVisible: false });
    const shown = control.changesApply({ inspectorVisible: true, toolbarVisible: true });
    expect(shown.inspectorVisible).toBe(true);
    expect(shown.toolbarVisible).toBe(true);
    expect(docks.frame.isToolbarVisible()).toBe(true);
  });
});
