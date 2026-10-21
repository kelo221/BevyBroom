import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BuilderEditorShell,
  type EditorShellElements,
  type EditorShellOutlinerActions,
  type EditorShellServices,
} from '@/layout/shell/builder_editor_shell.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import { HandlerHierarchyReparent } from '@/outliner/hierarchy/handler_hierarchy_reparent.js';
import { shellMenusBuiltinCreate } from '@/layout/shell/menubar/shell_menu_bar.js';
import { SHELL_TOOL_BAR_TOOL_SLOT_CLASS } from '@/layout/shell/toolbar/shell_tool_bar_builder.js';
import { SHELL_STATE_STORAGE_KEY } from '@/layout/shell/state/shell_state_store.js';
import { allowEditorStorageWritesForTests } from '@/settings/storage/clear_editor_storage.js';
import { ShellTestWindowActions, shellTestToolbarActionsCreate } from './shell_test_support.js';

/** Viewport pane ids the shell seeds, in container order. */
const BUILDER_EDITOR_SHELL_TEST_PANE_IDS = ['pane_top', 'pane_front', 'pane_side', 'pane_perspective'];

/** Shells built by the running test. */
const builderEditorShellTestShells: EditorShellElements[] = [];

/**
 * Creates the scene services the shell panels bind to.
 *
 * @returns Fresh scene services.
 */
function builderEditorShellTestServicesCreate(): EditorShellServices {
  const worldObject = new THREE.Group();
  const commandStack = new CommandStack(50);
  return {
    selectionManager: new ManagerSelection(),
    worldObject,
    commandStack,
    gridSnap: new GridSnap(true, 1),
    textureLock: new TextureLockSettings(),
    hierarchyReparentHandler: new HandlerHierarchyReparent(worldObject, commandStack),
  };
}

/**
 * Creates outliner actions where every callback is a spy.
 *
 * @returns Outliner actions.
 */
function builderEditorShellTestOutlinerActionsCreate(): EditorShellOutlinerActions {
  return {
    onDuplicateFromOutliner: vi.fn(),
    onDeleteFromOutliner: vi.fn(),
    onGroupFromOutliner: vi.fn(),
    onUngroupFromOutliner: vi.fn(),
    onRenameFromOutliner: vi.fn(),
    onToggleVisibilityFromOutliner: vi.fn(),
    onToggleLockFromOutliner: vi.fn(),
    reparentFromDrop: vi.fn(),
    syncViewports: vi.fn(),
    refreshOutliner: vi.fn(),
    showStatusMessage: vi.fn(),
  };
}

/**
 * Builds the shell under a fresh mounted container.
 *
 * @returns Shell elements and the editor container.
 */
function builderEditorShellTestBuild(): { shell: EditorShellElements; editorContainer: HTMLElement } {
  const editorContainer = document.createElement('div');
  document.body.appendChild(editorContainer);
  const shell = new BuilderEditorShell().build(editorContainer, builderEditorShellTestServicesCreate(), {
    outlinerActions: builderEditorShellTestOutlinerActionsCreate(),
    toolbarActions: shellTestToolbarActionsCreate(),
    windowActions: new ShellTestWindowActions(),
  });
  builderEditorShellTestShells.push(shell);
  return { shell, editorContainer };
}

/**
 * Removes a built shell and its panels from the document.
 *
 * @param shell Shell elements.
 */
function builderEditorShellTestDispose(shell: EditorShellElements): void {
  shell.statusBar.dispose();
  shell.outlinerPanel.dispose();
  shell.propertiesPanel.dispose();
  shell.menuBar.dispose();
  shell.toolbar.dispose();
  shell.inspector.dispose();
  shell.infoPanel.dispose();
  shell.frame.dispose();
}

beforeEach(() => {
  allowEditorStorageWritesForTests();
  localStorage.removeItem(SHELL_STATE_STORAGE_KEY);
});

afterEach(() => {
  builderEditorShellTestShells.splice(0).forEach((shell) => builderEditorShellTestDispose(shell));
  localStorage.removeItem(SHELL_STATE_STORAGE_KEY);
  document.body.replaceChildren();
});

describe('BuilderEditorShell', () => {
  it('mounts the main window frame in the editor container', () => {
    const { shell, editorContainer } = builderEditorShellTestBuild();
    expect(shell.toolbarContainer).toBe(shell.frame.getElement());
    expect(shell.frame.getElement().parentElement).toBe(editorContainer);
  });

  it('fills the menu bar host with the main window menus in order', () => {
    const { shell } = builderEditorShellTestBuild();
    expect(shell.frame.menuBarHostRead().contains(shell.menuBar.getElement())).toBe(true);
    const headers = [...shell.menuBar.getElement().querySelectorAll('.editor-toolbar-menu-button')];
    expect(headers.map((header) => (header.textContent ?? '').trim())).toEqual(
      shellMenusBuiltinCreate().map((menu) => menu.label),
    );
  });

  it('docks the tool buttons into the toolbar slot and the tool options into the view bar', () => {
    const { shell } = builderEditorShellTestBuild();
    expect(shell.frame.toolbarHostRead().contains(shell.toolbar.getElement())).toBe(true);
    expect(shell.toolChromeDocking.railParent.parentElement).toBe(shell.toolbar.getElement());
    expect(shell.toolChromeDocking.railParent.classList.contains(SHELL_TOOL_BAR_TOOL_SLOT_CLASS)).toBe(true);
    expect(shell.toolChromeDocking.optionsParent).toBe(shell.frame.viewBarToolSlotRead());
  });

  it('places the viewport area below the view bar with the four seed panes', () => {
    const { shell } = builderEditorShellTestBuild();
    const viewColumn = shell.frame.viewColumnRead();
    const children = [...viewColumn.children];
    expect(children.indexOf(shell.viewportArea)).toBeGreaterThan(0);
    expect(shell.viewportArea.contains(shell.viewportPaneGrid)).toBe(true);
    expect(shell.viewports.map((pane) => pane.dataset['areaId'])).toEqual(BUILDER_EDITOR_SHELL_TEST_PANE_IDS);
    shell.viewports.forEach((pane) => expect(pane.parentElement).toBe(shell.viewportPaneGrid));
  });

  it('mounts the docks into the frame and the panels into their inspector slots', () => {
    const { shell } = builderEditorShellTestBuild();
    expect(shell.frame.inspectorHostRead().contains(shell.inspector.getElement())).toBe(true);
    expect(shell.frame.infoPanelHostRead().contains(shell.infoPanel.getElement())).toBe(true);
    expect(shell.inspector.slotRead('map_outliner').contains(shell.outlinerPanel.getElement())).toBe(true);
    expect(shell.inspector.slotRead('entity_properties').contains(shell.propertiesPanel.getContainer())).toBe(true);
  });

  it('adds the status bar as the last row of the main window', () => {
    const { shell } = builderEditorShellTestBuild();
    expect(shell.frame.getElement().lastElementChild).toBe(shell.statusBar.getRootElement());
  });

  it('restores dock visibility chosen in an earlier shell', () => {
    const first = builderEditorShellTestBuild();
    first.shell.dockCommands.inspectorToggle();
    first.shell.dockCommands.toolbarToggle();
    const second = builderEditorShellTestBuild();
    expect(second.shell.dockCommands.isInspectorVisible()).toBe(false);
    expect(second.shell.dockCommands.isToolbarVisible()).toBe(false);
    expect(second.shell.dockCommands.isInfoPanelVisible()).toBe(true);
  });
});
