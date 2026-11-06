import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { WorkspaceDefinition } from '@/layout/workspace/workspace_definition.js';
import { createDefaultWorkspaces } from '@/layout/workspace/workspace_definition.js';

/** Callbacks run by the layout chooser menu. */
export interface WorkspaceSwitcherMenuActions {
  /**
   * Switches to a layout.
   *
   * @param workspaceId Target layout id.
   */
  onSelectWorkspace(workspaceId: string): void;

  /**
   * Adds a new layout from a default template.
   *
   * @param template Default layout definition (name and arrangement).
   */
  onAddPresetWorkspace(template: WorkspaceDefinition): void;

  /** Adds a copy of the current layout. */
  onDuplicateCurrent(): void;

  /**
   * Deletes a layout when allowed.
   *
   * @param workspaceId Target layout id.
   */
  onDeleteWorkspace(workspaceId: string): void;

  /**
   * Moves a layout to a new position in the list.
   *
   * @param workspaceId Moved layout id.
   * @param toIndex Destination index after the move.
   */
  onReorderWorkspace(workspaceId: string, toIndex: number): void;

  /** Starts renaming the active layout in place. */
  onRenameActiveBegin(): void;
}

/** Label of the submenu that adds a new layout. */
export const WORKSPACE_SWITCHER_MENU_NEW_LABEL = 'New Layout';

/**
 * Builds the layout chooser menu: one checked row per layout, then the New
 * Layout submenu and the rename, move and delete actions of the active layout.
 *
 * @param workspaces Layouts in display order.
 * @param activeId Id of the active layout.
 * @param actions Callbacks of the rows.
 * @returns Menu entries.
 */
export function workspaceSwitcherMenuEntriesBuild(
  workspaces: readonly WorkspaceDefinition[],
  activeId: string,
  actions: WorkspaceSwitcherMenuActions,
): ToolbarMenuEntry[] {
  return [
    ...workspaceSwitcherMenuLayoutRowsBuild(workspaces, activeId, actions),
    { kind: 'separator' },
    workspaceSwitcherMenuNewSubmenuBuild(actions),
    ...workspaceSwitcherMenuActiveRowsBuild(workspaces, activeId, actions),
  ];
}

/**
 * Builds one row per layout, checked on the active one.
 *
 * @param workspaces Layouts in display order.
 * @param activeId Id of the active layout.
 * @param actions Callbacks of the rows.
 * @returns Layout rows.
 */
function workspaceSwitcherMenuLayoutRowsBuild(
  workspaces: readonly WorkspaceDefinition[],
  activeId: string,
  actions: WorkspaceSwitcherMenuActions,
): ToolbarMenuEntry[] {
  return workspaces.map((workspace) => ({
    label: workspace.name,
    isChecked: () => workspace.id === activeId,
    onClick: () => {
      if (workspace.id !== activeId) {
        actions.onSelectWorkspace(workspace.id);
      }
    },
  }));
}

/**
 * Builds the New Layout submenu: the default templates and Duplicate Current.
 *
 * @param actions Callbacks of the rows.
 * @returns Submenu entry.
 */
function workspaceSwitcherMenuNewSubmenuBuild(actions: WorkspaceSwitcherMenuActions): ToolbarMenuEntry {
  const templates: ToolbarMenuEntry[] = createDefaultWorkspaces().map((template) => ({
    label: template.name,
    onClick: () => actions.onAddPresetWorkspace(template),
  }));
  return {
    kind: 'submenu',
    label: WORKSPACE_SWITCHER_MENU_NEW_LABEL,
    children: [
      ...templates,
      { kind: 'separator' },
      { label: 'Duplicate Current', tooltip: 'Add a copy of the current layout.', onClick: actions.onDuplicateCurrent },
    ],
  };
}

/**
 * Builds the rename, move left, move right and delete rows of the active
 * layout, each enabled only when it can apply.
 *
 * @param workspaces Layouts in display order.
 * @param activeId Id of the active layout.
 * @param actions Callbacks of the rows.
 * @returns Active layout rows.
 */
function workspaceSwitcherMenuActiveRowsBuild(
  workspaces: readonly WorkspaceDefinition[],
  activeId: string,
  actions: WorkspaceSwitcherMenuActions,
): ToolbarMenuEntry[] {
  const activeIndex = workspaces.findIndex((workspace) => workspace.id === activeId);
  return [
    { label: 'Rename Layout…', isEnabled: () => activeIndex >= 0, onClick: () => actions.onRenameActiveBegin() },
    workspaceSwitcherMenuMoveRowBuild('Move Layout Left', activeId, activeIndex - 1, workspaces.length, actions),
    workspaceSwitcherMenuMoveRowBuild(
      'Move Layout Right',
      activeId,
      activeIndex < 0 ? -1 : activeIndex + 1,
      workspaces.length,
      actions,
    ),
    { kind: 'separator' },
    {
      label: 'Delete Layout',
      isEnabled: () => activeIndex >= 0 && workspaces.length > 1,
      onClick: () => actions.onDeleteWorkspace(activeId),
    },
  ];
}

/**
 * Builds a row that moves the active layout to a neighbouring index, enabled
 * only while that index exists.
 *
 * @param label Row label.
 * @param activeId Id of the active layout.
 * @param targetIndex Destination index of the move.
 * @param workspaceCount Number of layouts.
 * @param actions Callbacks of the rows.
 * @returns Move row.
 */
function workspaceSwitcherMenuMoveRowBuild(
  label: string,
  activeId: string,
  targetIndex: number,
  workspaceCount: number,
  actions: WorkspaceSwitcherMenuActions,
): ToolbarMenuEntry {
  return {
    label,
    isEnabled: () => targetIndex >= 0 && targetIndex < workspaceCount,
    onClick: () => actions.onReorderWorkspace(activeId, targetIndex),
  };
}
