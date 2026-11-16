import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { platformIsMac } from '@/platform/platform_kind.js';
import { themeLookMenuBuild } from '@/theme/menu/theme_look_menu.js';

/** View menu: grid, camera framing, view switching and the main window docks. */
export class ShellMenuView extends ShellMenu {
  readonly label = 'View';

  /**
   * Builds the View menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    return [
      this.gridSubmenuBuild(context),
      this.separatorEntry(),
      this.frameSelectionEntryBuild(context),
      this.actionEntry(context, 'Frame Selection in All Views', () => window.frameAll(), { shortcutAction: 'fit_all' }),
      this.actionEntry(context, 'Cycle View', () => window.viewCycle(), { shortcutAction: 'view_cycle' }),
      this.actionEntry(context, 'Maximize View', () => window.viewMaximize(), { shortcutAction: 'view_maximize' }),
      this.separatorEntry(),
      ...this.visibilityEntriesBuild(context),
      this.separatorEntry(),
      ...this.dockToggleEntriesBuild(context),
      this.separatorEntry(),
      ...this.lookEntriesBuild(),
      this.editorSoundsEntryBuild(context),
    ];
  }

  /**
   * Builds the Frame Selection row.
   *
   * @param context Actions and docks the entry runs.
   * @returns Menu action entry.
   */
  frameSelectionEntryBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const window = context.windowActions;
    return this.actionEntry(context, 'Frame Selection', () => window.frameSelection(), {
      shortcutAction: 'fit_selection',
    });
  }

  /**
   * Builds the Look submenu on macOS; other platforms keep the classic look and
   * get no entries.
   *
   * @returns Look submenu on macOS, otherwise nothing.
   */
  private lookEntriesBuild(): ToolbarMenuEntry[] {
    return platformIsMac() ? [themeLookMenuBuild()] : [];
  }

  /**
   * Builds the Grid submenu: grid size steps and every preset size.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private gridSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return {
      kind: 'submenu',
      label: 'Grid',
      children: [
        this.actionEntry(context, 'Increase Grid Size', () => actions.onSnapIntervalForward(), {
          shortcutAction: 'snap_forward',
        }),
        this.actionEntry(context, 'Decrease Grid Size', () => actions.onSnapIntervalBackward(), {
          shortcutAction: 'snap_backward',
        }),
        this.separatorEntry(),
        ...this.gridPresetEntriesBuild(context),
      ],
    };
  }

  /**
   * Builds one checked row per preset grid size.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entries.
   */
  private gridPresetEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    return SNAP_PRESETS.map((interval) =>
      this.actionEntry(context, formatGridIntervalLabel(interval), () => window.gridIntervalSet(interval), {
        isChecked: () => window.gridIntervalRead() === interval,
      }),
    );
  }

  /**
   * Builds the Hide Selected, Isolate Selected and Show All rows.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entries.
   */
  visibilityEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    return [
      this.actionEntry(context, 'Hide Selected', () => window.selectionVisibilityRead()?.hideSelected(), {
        shortcutAction: 'visibility_hide',
        isEnabled: () => window.selectionHasObjectsIs(),
      }),
      this.actionEntry(context, 'Isolate Selected', () => window.selectionVisibilityRead()?.isolateSelected(), {
        shortcutAction: 'visibility_isolate',
        isEnabled: () => window.selectionHasObjectsIs(),
      }),
      this.actionEntry(context, 'Show All', () => window.selectionVisibilityRead()?.showAll(), {
        shortcutAction: 'visibility_show_all',
      }),
    ];
  }

  /**
   * Builds the row that switches the editor sounds on and off, checked while
   * on.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entry.
   */
  private editorSoundsEntryBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return this.actionEntry(context, 'Editor Sounds', () => actions.onToggleAudio(), {
      isChecked: () => actions.isAudioEnabled(),
    });
  }

  /**
   * Builds the rows that show or hide the inspector, the info panel, the
   * toolbar and the tools palette, and the row that collapses the info panel to
   * its strip.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entries.
   */
  private dockToggleEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    return [...this.dockPanelEntriesBuild(context), ...this.barToggleEntriesBuild(context)];
  }

  /**
   * Builds the rows that show or hide the inspector and the info panel, and the
   * row that collapses the info panel to its strip.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entries.
   */
  private dockPanelEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const docks = context.dockCommands;
    return [
      this.actionEntry(context, 'Show Inspector', () => docks.inspectorToggle(), {
        shortcutAction: 'inspector_toggle',
        isChecked: () => docks.isInspectorVisible(),
      }),
      this.actionEntry(context, 'Show Info Panel', () => docks.infoPanelToggle(), {
        shortcutAction: 'info_panel_toggle',
        isChecked: () => docks.isInfoPanelVisible(),
      }),
      this.actionEntry(context, 'Collapse Info Panel', () => docks.infoPanelCollapsedToggle(), {
        shortcutAction: 'info_panel_collapse_toggle',
        isChecked: () => docks.isInfoPanelCollapsed(),
      }),
    ];
  }

  /**
   * Builds the rows that show or hide the toolbar and the tools palette.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entries.
   */
  private barToggleEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const docks = context.dockCommands;
    return [
      this.actionEntry(context, 'Show Toolbar', () => docks.toolbarToggle(), {
        shortcutAction: 'toolbar_toggle',
        isChecked: () => docks.isToolbarVisible(),
      }),
      this.actionEntry(context, 'Show Tools Palette', () => docks.toolsPaletteToggle(), {
        isChecked: () => docks.isToolsPaletteVisible(),
      }),
    ];
  }
}
