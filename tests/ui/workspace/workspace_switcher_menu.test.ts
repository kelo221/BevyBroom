import { describe, expect, it, vi } from 'vitest';
import {
  WORKSPACE_SWITCHER_MENU_NEW_LABEL,
  workspaceSwitcherMenuEntriesBuild,
  type WorkspaceSwitcherMenuActions,
} from '@/ui/workspace/workspace_switcher_menu.js';
import { createDefaultWorkspaces } from '@/layout/workspace/workspace_definition.js';
import { isMenuAction, type ToolbarMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Creates menu actions whose every callback is a spy.
 *
 * @returns Spy actions.
 */
function workspaceSwitcherMenuTestActionsCreate(): WorkspaceSwitcherMenuActions {
  return {
    onSelectWorkspace: vi.fn(),
    onAddPresetWorkspace: vi.fn(),
    onDuplicateCurrent: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onReorderWorkspace: vi.fn(),
    onRenameActiveBegin: vi.fn(),
  };
}

/**
 * Returns the action row with a label among some entries.
 *
 * @param entries Menu entries.
 * @param label Row label.
 * @returns Action row.
 */
function workspaceSwitcherMenuTestRowRead(entries: readonly ToolbarMenuEntry[], label: string): ToolbarMenuAction {
  const row = entries.find((entry): entry is ToolbarMenuAction => isMenuAction(entry) && entry.label === label);
  if (!row) {
    throw new Error(`Row ${label} missing`);
  }
  return row;
}

/**
 * Returns the children of the New Layout submenu.
 *
 * @param entries Menu entries.
 * @returns Submenu children.
 */
function workspaceSwitcherMenuTestNewChildrenRead(entries: readonly ToolbarMenuEntry[]): readonly ToolbarMenuEntry[] {
  const submenu = entries.find(
    (entry) => 'kind' in entry && entry.kind === 'submenu' && entry.label === WORKSPACE_SWITCHER_MENU_NEW_LABEL,
  );
  if (!submenu || !('children' in submenu)) {
    throw new Error('New Layout submenu missing');
  }
  return submenu.children;
}

describe('workspaceSwitcherMenuEntriesBuild', () => {
  it('lists one row per layout and checks only the active one', () => {
    const workspaces = createDefaultWorkspaces();
    const active = workspaces[workspaces.length - 1];
    const entries = workspaceSwitcherMenuEntriesBuild(
      workspaces,
      active?.id ?? '',
      workspaceSwitcherMenuTestActionsCreate(),
    );
    workspaces.forEach((workspace) => {
      const row = workspaceSwitcherMenuTestRowRead(entries, workspace.name);
      expect(row.isChecked?.()).toBe(workspace.id === active?.id);
    });
  });

  it('adds a layout from every default template and duplicates the current one', () => {
    const workspaces = createDefaultWorkspaces();
    const actions = workspaceSwitcherMenuTestActionsCreate();
    const children = workspaceSwitcherMenuTestNewChildrenRead(
      workspaceSwitcherMenuEntriesBuild(workspaces, workspaces[0]?.id ?? '', actions),
    );
    createDefaultWorkspaces().forEach((template) => {
      workspaceSwitcherMenuTestRowRead(children, template.name).onClick();
      expect(actions.onAddPresetWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ name: template.name }));
    });
    workspaceSwitcherMenuTestRowRead(children, 'Duplicate Current').onClick();
    expect(actions.onDuplicateCurrent).toHaveBeenCalledOnce();
  });

  it('enables moving left only after the first layout and right only before the last', () => {
    const workspaces = createDefaultWorkspaces();
    const actions = workspaceSwitcherMenuTestActionsCreate();
    workspaces.forEach((workspace, index) => {
      const entries = workspaceSwitcherMenuEntriesBuild(workspaces, workspace.id, actions);
      expect(workspaceSwitcherMenuTestRowRead(entries, 'Move Layout Left').isEnabled?.()).toBe(index > 0);
      expect(workspaceSwitcherMenuTestRowRead(entries, 'Move Layout Right').isEnabled?.()).toBe(
        index < workspaces.length - 1,
      );
    });
    const first = workspaces[0];
    const firstEntries = workspaceSwitcherMenuEntriesBuild(workspaces, first?.id ?? '', actions);
    workspaceSwitcherMenuTestRowRead(firstEntries, 'Move Layout Right').onClick();
    expect(actions.onReorderWorkspace).toHaveBeenCalledWith(first?.id, 1);
  });

  it('deletes the active layout only while another layout remains', () => {
    const workspaces = createDefaultWorkspaces();
    const actions = workspaceSwitcherMenuTestActionsCreate();
    const onlyLayout = workspaces.slice(0, 1);
    const single = workspaceSwitcherMenuEntriesBuild(onlyLayout, onlyLayout[0]?.id ?? '', actions);
    expect(workspaceSwitcherMenuTestRowRead(single, 'Delete Layout').isEnabled?.()).toBe(false);
    const all = workspaceSwitcherMenuEntriesBuild(workspaces, workspaces[1]?.id ?? '', actions);
    const deleteRow = workspaceSwitcherMenuTestRowRead(all, 'Delete Layout');
    expect(deleteRow.isEnabled?.()).toBe(true);
    deleteRow.onClick();
    expect(actions.onDeleteWorkspace).toHaveBeenCalledWith(workspaces[1]?.id);
  });

  it('starts renaming the active layout', () => {
    const workspaces = createDefaultWorkspaces();
    const actions = workspaceSwitcherMenuTestActionsCreate();
    const entries = workspaceSwitcherMenuEntriesBuild(workspaces, workspaces[0]?.id ?? '', actions);
    workspaceSwitcherMenuTestRowRead(entries, 'Rename Layout…').onClick();
    expect(actions.onRenameActiveBegin).toHaveBeenCalledOnce();
  });
});
