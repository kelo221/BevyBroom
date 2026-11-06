import type { Toolbar } from '@/ui/toolbar/toolbar.js';
import { IconHammerCatalog } from '@/ui/icons/hammer/icon_hammer_catalog.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';
import type { EditorToolbarActions } from '@/layout/shell/builder_editor_shell.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';
import { getStateSelectionFilter } from '@/selection/filter/state_selection_filter.js';
import { TOOLBAR_OVERFLOW_PRIORITY_TRAILING } from '@/ui/toolbar/overflow/toolbar_overflow_item.js';
import type { ToolbarOverflowController } from '@/ui/toolbar/overflow/toolbar_overflow_controller.js';
import type { ToolbarOverflowMeasure } from '@/ui/toolbar/overflow/toolbar_overflow_measure.js';

/** CSS class of the toolbar slot that receives the active tool options. */
export const SHELL_TOOL_BAR_TOOL_OPTIONS_SLOT_CLASS = 'shell-toolbar-tool-options-slot';

/** CSS class of the toolbar slot that receives the layout chooser. */
export const SHELL_TOOL_BAR_LAYOUT_SLOT_CLASS = 'shell-toolbar-layout-slot';

/** Slots and overflow control of the single main toolbar row. */
export interface ShellToolBarParts {
  /** Slot after the global actions that receives the active tool options. */
  readonly toolOptionsSlot: HTMLElement;
  /** Slot on the right that receives the layout chooser. */
  readonly layoutSlot: HTMLElement;
  /** Moves the items that do not fit into the overflow menu. */
  readonly overflow: ToolbarOverflowController;
}

/**
 * Fills the single main toolbar row: history, object edits, snapping and the
 * grid size, gizmo axes and texture locks, then the active tool options, the
 * overflow menu, and on the right the layout chooser and the MCP server
 * status.
 */
export class ShellToolBarBuilder {
  /**
   * Adds every toolbar group.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   * @param windowActions Window actions for the grid size.
   * @param overflowMeasure Optional width check of the row for the overflow
   *   menu.
   * @returns Slots for the tool options and the layout chooser, and the
   *   overflow control.
   */
  build(
    toolbar: Toolbar,
    actions: EditorToolbarActions,
    windowActions: ShellWindowActions,
    overflowMeasure?: ToolbarOverflowMeasure,
  ): ShellToolBarParts {
    this.globalActionsAdd(toolbar, actions, windowActions);
    toolbar.addSeparator();
    const toolOptionsSlot = toolbar.addSlot(SHELL_TOOL_BAR_TOOL_OPTIONS_SLOT_CLASS);
    const overflow = toolbar.addOverflowMenu(overflowMeasure);
    toolbar.addTrailingSpacer();
    const layoutSlot = toolbar.addSlot(SHELL_TOOL_BAR_LAYOUT_SLOT_CLASS);
    toolbar.overflowPrioritySet(TOOLBAR_OVERFLOW_PRIORITY_TRAILING);
    this.mcpButtonAdd(toolbar, actions);
    return { toolOptionsSlot, layoutSlot, overflow };
  }

  /**
   * Adds the global action groups separated from each other.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   * @param windowActions Window actions for the grid size and brush tools.
   */
  private globalActionsAdd(toolbar: Toolbar, actions: EditorToolbarActions, windowActions: ShellWindowActions): void {
    this.historyGroupAdd(toolbar, actions);
    toolbar.addSeparator();
    this.objectEditGroupAdd(toolbar, actions, windowActions);
    toolbar.addSeparator();
    this.gridGroupAdd(toolbar, actions, windowActions);
    toolbar.addSeparator();
    this.gizmoAxesGroupAdd(toolbar, actions);
    toolbar.addSeparator();
    this.textureLockGroupAdd(toolbar, actions);
  }

  /**
   * Adds the undo and redo buttons.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private historyGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('Undo', IconHammerCatalog.toolbarSvg('edit_undo'), () => actions.onUndo());
    toolbar.addIconButton('Redo', IconHammerCatalog.toolbarSvg('edit_redo'), () => actions.onRedo());
  }

  /**
   * Adds the Duplicate, Flip Horizontally, Flip Vertically, Group, Ungroup and
   * Ignore Groups buttons.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   * @param windowActions Window actions holding the brush tools.
   */
  private objectEditGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions, windowActions: ShellWindowActions): void {
    toolbar.addIconButton('Duplicate', IconHammerCatalog.toolbarSvg('edit_duplicate'), () =>
      actions.onDuplicateSelected(),
    );
    toolbar.addIconButton('Flip Horizontally', IconHammerCatalog.toolbarSvg('csg_flip_horizontal'), () =>
      windowActions.solidBrushToolsRead()?.flip('horizontal'),
    );
    toolbar.addIconButton('Flip Vertically', IconHammerCatalog.toolbarSvg('csg_flip_vertical'), () =>
      windowActions.solidBrushToolsRead()?.flip('vertical'),
    );
    this.hammerGroupButtonsAdd(toolbar, actions);
  }

  /**
   * Adds the Hammer++ Group, Ungroup, and Ignore Groups (ig) buttons.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private hammerGroupButtonsAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('Group', IconHammerCatalog.toolbarSvg('csg_group'), () => actions.onGroupSelected());
    toolbar.addIconButton('Ungroup', IconHammerCatalog.toolbarSvg('csg_ungroup'), () => actions.onUngroupSelected());
    const filterState = getStateSelectionFilter();
    toolbar.addIconButton('Ignore Groups', IconHammerCatalog.toolbarSvg('selection_ignore_groups'), () => {
      filterState.ignoreGroupsWrite(!filterState.ignoreGroupsRead());
    });
    toolbar.setButtonActiveByLabel('Ignore Groups', filterState.ignoreGroupsRead());
    filterState.changeListenerAdd(() => {
      toolbar.setButtonActiveByLabel('Ignore Groups', filterState.ignoreGroupsRead());
    });
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
    toolbar.addIconButton('Snap', IconHammerCatalog.toolbarSvg('grid_snap'), () => actions.onToggleSnap());
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
   * Adds the Global and Local gizmo axes icon toggles with the current choice
   * highlighted.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private gizmoAxesGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('Global', IconHammerCatalog.toolbarSvg('transform_space_global'), () =>
      actions.onSetTransformSpaceGlobal(),
    ).title = 'Gizmo axes: world (global)';
    toolbar.addIconButton('Local', IconHammerCatalog.toolbarSvg('transform_space_local'), () =>
      actions.onSetTransformSpaceLocal(),
    ).title = 'Gizmo axes: object local';
    const isLocal = actions.isTransformSpaceLocal();
    toolbar.setButtonActiveByLabel('Global', !isLocal);
    toolbar.setButtonActiveByLabel('Local', isLocal);
  }

  /**
   * Adds the position lock and stretch lock icon toggles.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private textureLockGroupAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('Pos Lock', IconHammerCatalog.toolbarSvg('texture_lock_position'), () =>
      actions.onTogglePositionLock(),
    ).title = 'Position lock: UVs stick when moving/rotating (off = world slide)';
    toolbar.setButtonActiveByLabel('Pos Lock', actions.isPositionLockEnabled());
    toolbar.addIconButton('Stretch Lock', IconHammerCatalog.toolbarSvg('texture_lock_stretch'), () =>
      actions.onToggleStretchLock(),
    ).title = 'Stretch lock: UVs stretch when scaling (off = tile density)';
    toolbar.setButtonActiveByLabel('Stretch Lock', actions.isStretchLockEnabled());
  }

  /**
   * Adds the MCP server button, highlighted while the server runs.
   *
   * @param toolbar Main toolbar.
   * @param actions Scene toolbar actions.
   */
  private mcpButtonAdd(toolbar: Toolbar, actions: EditorToolbarActions): void {
    toolbar.addIconButton('MCP', IconHammerCatalog.toolbarSvg('run_mcp'), () => actions.onOpenMcpDialog()).title =
      'MCP server (highlighted when running)';
    toolbar.setButtonActiveByLabel('MCP', false);
  }
}
