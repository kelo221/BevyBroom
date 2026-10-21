import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';
import type { ShellInspectorTabId } from '@/layout/shell/inspector/shell_inspector.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/**
 * Inspector tabs listed in the View menu with their labels and shortcut
 * actions.
 */
const SHELL_MENU_VIEW_INSPECTOR_TABS: ReadonlyArray<readonly [ShellInspectorTabId, string, KeyboardShortcutAction]> = [
  ['map', 'Map Inspector', 'inspector_map'],
  ['entity', 'Entity Inspector', 'inspector_entity'],
  ['face', 'Face Inspector', 'inspector_face'],
];

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
      this.actionEntry(context, 'Frame Selection', () => window.frameSelection(), { shortcutAction: 'fit_selection' }),
      this.actionEntry(context, 'Frame Selection in All Views', () => window.frameAll(), { shortcutAction: 'fit_all' }),
      this.actionEntry(context, 'Cycle View', () => window.viewCycle(), { shortcutAction: 'view_cycle' }),
      this.actionEntry(context, 'Maximize View', () => window.viewMaximize(), { shortcutAction: 'view_maximize' }),
      this.separatorEntry(),
      ...SHELL_MENU_VIEW_INSPECTOR_TABS.map((tab) => this.inspectorTabEntryBuild(context, tab)),
      this.separatorEntry(),
      ...this.dockToggleEntriesBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Detached Viewport…', () => context.toolbarActions.onOpenDetachedViewport()),
    ];
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
   * Builds the row that shows one inspector tab.
   *
   * @param context Actions and docks the entries run.
   * @param tab Tab id, row label and shortcut action.
   * @returns Menu action entry checked while that tab is shown.
   */
  private inspectorTabEntryBuild(
    context: ShellMenuContext,
    tab: readonly [ShellInspectorTabId, string, KeyboardShortcutAction],
  ): ToolbarMenuEntry {
    const [tabId, label, shortcutAction] = tab;
    const docks = context.dockCommands;
    return this.actionEntry(context, label, () => docks.inspectorTabReveal(tabId), {
      shortcutAction,
      isChecked: () => docks.isInspectorTabShown(tabId),
    });
  }

  /**
   * Builds the rows that show or hide the inspector, the info panel and the
   * toolbar.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entries.
   */
  private dockToggleEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
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
      this.actionEntry(context, 'Show Toolbar', () => docks.toolbarToggle(), {
        shortcutAction: 'toolbar_toggle',
        isChecked: () => docks.isToolbarVisible(),
      }),
    ];
  }
}
