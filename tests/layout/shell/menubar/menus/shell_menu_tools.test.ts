import { afterEach, describe, expect, it } from 'vitest';
import { ShellMenuTools } from '@/layout/shell/menubar/menus/shell_menu_tools.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { toolInstructionForEditorTool } from '@/tools/chrome/instruction/tool_instruction_catalog.js';
import type { EditorToolbarActions } from '@/layout/shell/builder_editor_shell.js';
import { isMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import {
  ShellTestWindowActions,
  shellTestDocksCreate,
  shellTestDocksDispose,
  shellTestMenuActionFind,
  shellTestMenuContextCreate,
  shellTestMenuLabelsRead,
  shellTestToolbarActionsCreate,
  type ShellTestDocks,
  type ShellTestToolbarActions,
} from '../../shell_test_support.js';

/** Every editor tool the Tools menu offers. */
const SHELL_MENU_TOOLS_TEST_TOOL_IDS: readonly EditorToolId[] = [
  EditorToolId.OBJECT,
  EditorToolId.FACE,
  EditorToolId.CLIP_PLANE,
  EditorToolId.GRID,
];

/**
 * Toggle rows of the Tools menu with the toolbar action they run and the state
 * they check.
 */
const SHELL_MENU_TOOLS_TEST_TOGGLE_ROWS: ReadonlyArray<
  readonly [string, keyof EditorToolbarActions, 'isUserSnapEnabled' | 'isPositionLockEnabled' | 'isStretchLockEnabled']
> = [
  ['Snap to Grid', 'onToggleSnap', 'isUserSnapEnabled'],
  ['Position Lock', 'onTogglePositionLock', 'isPositionLockEnabled'],
  ['Stretch Lock', 'onToggleStretchLock', 'isStretchLockEnabled'],
];

/** Toggle states the test toolbar actions report. */
interface ShellMenuToolsTestToggles {
  snap: boolean;
  positionLock: boolean;
  stretchLock: boolean;
  transformSpaceLocal: boolean;
}

/** Docks, actions, toggle states and Tools menu entries shared by one test. */
interface ShellMenuToolsTestRig {
  readonly docks: ShellTestDocks;
  readonly toolbarActions: ShellTestToolbarActions;
  readonly windowActions: ShellTestWindowActions;
  readonly toggles: ShellMenuToolsTestToggles;
  readonly entries: ToolbarMenuEntry[];
}

/** Rig built by the running test. */
let shellMenuToolsTestRig: ShellMenuToolsTestRig | null = null;

/**
 * Creates toolbar actions whose toggle reads report the given states.
 *
 * @param toggles Mutable toggle states.
 * @returns Spy toolbar actions.
 */
function shellMenuToolsTestToolbarActionsCreate(toggles: ShellMenuToolsTestToggles): ShellTestToolbarActions {
  return shellTestToolbarActionsCreate({
    isUserSnapEnabled: () => toggles.snap,
    isPositionLockEnabled: () => toggles.positionLock,
    isStretchLockEnabled: () => toggles.stretchLock,
    isTransformSpaceLocal: () => toggles.transformSpaceLocal,
  });
}

/**
 * Builds docks, spy actions and the Tools menu entries for one test.
 *
 * @returns Test rig remembered for cleanup.
 */
function shellMenuToolsTestRigCreate(): ShellMenuToolsTestRig {
  const docks = shellTestDocksCreate();
  const toggles: ShellMenuToolsTestToggles = {
    snap: false,
    positionLock: false,
    stretchLock: false,
    transformSpaceLocal: false,
  };
  const toolbarActions = shellMenuToolsTestToolbarActionsCreate(toggles);
  const windowActions = new ShellTestWindowActions();
  const entries = new ShellMenuTools().entriesBuild(shellTestMenuContextCreate(docks, toolbarActions, windowActions));
  shellMenuToolsTestRig = { docks, toolbarActions, windowActions, toggles, entries };
  return shellMenuToolsTestRig;
}

/**
 * Returns the labels of the checked rows among some entries.
 *
 * @param entries Menu entries.
 * @returns Labels of action rows whose isChecked returns true.
 */
function shellMenuToolsTestCheckedLabelsRead(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.flatMap((entry) => (isMenuAction(entry) && entry.isChecked?.() === true ? [entry.label] : []));
}

/**
 * Returns the Tools menu row label of an editor tool.
 *
 * @param toolId Editor tool.
 * @returns Tool title.
 */
function shellMenuToolsTestToolLabelRead(toolId: EditorToolId): string {
  return toolInstructionForEditorTool(toolId).title;
}

afterEach(() => {
  if (shellMenuToolsTestRig) {
    shellTestDocksDispose(shellMenuToolsTestRig.docks);
    shellMenuToolsTestRig = null;
  }
  document.body.replaceChildren();
});

describe('ShellMenuTools', () => {
  it('is labelled Tools and lists every editor tool first, in tool order', () => {
    const { entries } = shellMenuToolsTestRigCreate();
    expect(new ShellMenuTools().label).toBe('Tools');
    const labels = shellTestMenuLabelsRead(entries);
    expect(labels.slice(0, SHELL_MENU_TOOLS_TEST_TOOL_IDS.length)).toEqual(
      SHELL_MENU_TOOLS_TEST_TOOL_IDS.map((toolId) => shellMenuToolsTestToolLabelRead(toolId)),
    );
  });

  SHELL_MENU_TOOLS_TEST_TOOL_IDS.forEach((toolId) => {
    it(`selects the ${toolId} tool on click and checks only its row`, () => {
      const { entries, windowActions } = shellMenuToolsTestRigCreate();
      shellTestMenuActionFind(entries, shellMenuToolsTestToolLabelRead(toolId)).onClick();
      expect(windowActions.toolSelect).toHaveBeenCalledWith(toolId);
      const toolLabels = SHELL_MENU_TOOLS_TEST_TOOL_IDS.map((id) => shellMenuToolsTestToolLabelRead(id));
      const checkedToolLabels = shellMenuToolsTestCheckedLabelsRead(entries).filter((label) =>
        toolLabels.includes(label),
      );
      expect(checkedToolLabels).toEqual([shellMenuToolsTestToolLabelRead(toolId)]);
    });
  });

  SHELL_MENU_TOOLS_TEST_TOGGLE_ROWS.forEach(([label, action, stateRead]) => {
    it(`runs ${label} and checks it from the toolbar state`, () => {
      const { entries, toolbarActions } = shellMenuToolsTestRigCreate();
      const row = shellTestMenuActionFind(entries, label);
      expect(row.isChecked?.()).toBe(false);
      toolbarActions[stateRead].mockReturnValue(true);
      expect(row.isChecked?.()).toBe(true);
      row.onClick();
      expect(toolbarActions[action]).toHaveBeenCalledTimes(1);
    });
  });

  it('checks Global or Local gizmo axes from the transform space and sets it on click', () => {
    const { entries, toolbarActions, toggles } = shellMenuToolsTestRigCreate();
    const global = shellTestMenuActionFind(entries, 'Gizmo Axes', 'Global');
    const local = shellTestMenuActionFind(entries, 'Gizmo Axes', 'Local');
    expect([global.isChecked?.(), local.isChecked?.()]).toEqual([true, false]);
    toggles.transformSpaceLocal = true;
    expect([global.isChecked?.(), local.isChecked?.()]).toEqual([false, true]);
    global.onClick();
    local.onClick();
    expect(toolbarActions.onSetTransformSpaceGlobal).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onSetTransformSpaceLocal).toHaveBeenCalledTimes(1);
  });

  it('opens the solid model panel', () => {
    const { entries, toolbarActions } = shellMenuToolsTestRigCreate();
    shellTestMenuActionFind(entries, 'Solid Model…').onClick();
    expect(toolbarActions.onToggleSolidModelPanel).toHaveBeenCalledTimes(1);
  });
});
