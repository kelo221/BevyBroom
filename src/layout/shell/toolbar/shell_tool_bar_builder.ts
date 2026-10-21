import type { Toolbar } from '@/ui/toolbar/toolbar.js';
import { ToolbarIcons } from '@/ui/toolbar/toolbar_icons.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';
import type { EditorToolbarActions } from '@/layout/shell/builder_editor_shell.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';

/** CSS class of the toolbar slot that receives the docked tool buttons. */
export const SHELL_TOOL_BAR_TOOL_SLOT_CLASS = 'shell-toolbar-tool-slot';

/**
 * Fills the main icon toolbar: history, the tool buttons slot, snapping and the
 * grid size, gizmo axes, texture locks, and the MCP server status on the
 * right.
 */
export class ShellToolBarBuilder {
  /**
   * Adds every toolbar group.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   * @param windowActions Window actions for the grid size.
   * @returns Slot that receives the docked tool buttons.
   */
  build(toolbar: Toolbar, actions: EditorToolbarActions, windowActions: ShellWindowActions): HTMLElement {
    this.historyGroupAdd(toolbar, actions);
    toolbar.addSeparator();
    const toolSlot = toolbar.addSlot(SHELL_TOOL_BAR_TOOL_SLOT_CLASS);
    toolbar.addSeparator();
    this.gridGroupAdd(toolbar, actions, windowActions);
    toolbar.addSeparator();
    this.gizmoAxesGroupAdd(toolbar, actions);
    toolbar.addSeparator();
    this.textureLockGroupAdd(toolbar, actions);
    toolbar.addTrailingSpacer();
    this.mcpButtonAdd(toolbar, actions);
    return toolSlot;
  }

  /**
   * Adds the undo and redo buttons.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private historyGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('Undo', ToolbarIcons.undo(), () => actions.onUndo());
    toolbar.addIconButton('Redo', ToolbarIcons.redo(), () => actions.onRedo());
  }

  /**
   * Adds the snap toggle and the grid size dropdown, which follows grid size
   * changes.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   * @param windowActions Window actions for the grid size.
   */
  private gridGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions, windowActions: ShellWindowActions): void {
    toolbar.addIconButton('Snap', ToolbarIcons.snap(), () => actions.onToggleSnap());
    toolbar.setButtonActiveByLabel('Snap', actions.isUserSnapEnabled());
    const gridLabel = formatGridIntervalLabel(windowActions.gridIntervalRead());
    const gridButton = toolbar.addDropdown(gridLabel, this.gridEntriesBuild(windowActions));
    gridButton.setAttribute('aria-label', 'Grid Size');
    windowActions.gridIntervalChangeListenerAdd((interval) => {
      toolbar.dropdownLabelSet(gridButton, formatGridIntervalLabel(interval));
    });
  }

  /**
   * Builds one checked entry per preset grid size.
   *
   * @param windowActions Window actions for the grid size.
   * @returns Grid size menu entries.
   */
  private gridEntriesBuild(windowActions: ShellWindowActions): ToolbarMenuEntry[] {
    return SNAP_PRESETS.map((interval) => ({
      label: formatGridIntervalLabel(interval),
      onClick: () => windowActions.gridIntervalSet(interval),
      isChecked: () => windowActions.gridIntervalRead() === interval,
    }));
  }

  /**
   * Adds the Global and Local gizmo axes buttons with the current choice
   * highlighted.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private gizmoAxesGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addButton('Global', () => actions.onSetTransformSpaceGlobal()).title = 'Gizmo axes: world (global)';
    toolbar.addButton('Local', () => actions.onSetTransformSpaceLocal()).title = 'Gizmo axes: object local';
    const isLocal = actions.isTransformSpaceLocal();
    toolbar.setButtonActiveByLabel('Global', !isLocal);
    toolbar.setButtonActiveByLabel('Local', isLocal);
  }

  /**
   * Adds the position lock and stretch lock toggles.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private textureLockGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addButton('Pos Lock', () => actions.onTogglePositionLock()).title =
      'Position lock: UVs stick when moving/rotating (off = world slide)';
    toolbar.setButtonActiveByLabel('Pos Lock', actions.isPositionLockEnabled());
    toolbar.addButton('Stretch Lock', () => actions.onToggleStretchLock()).title =
      'Stretch lock: UVs stretch when scaling (off = tile density)';
    toolbar.setButtonActiveByLabel('Stretch Lock', actions.isStretchLockEnabled());
  }

  /**
   * Adds the MCP server button, highlighted orange while the server runs.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private mcpButtonAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('MCP', ToolbarIcons.mcp(), () => actions.onOpenMcpDialog()).title =
      'MCP server (orange when running)';
    toolbar.setButtonActiveByLabel('MCP', false);
  }
}
