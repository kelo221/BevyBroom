import type { ToolbarMenuAction, ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { RunConfiguration } from '@/project/run_configuration/model/run_configuration_types.js';
import { runConfigurationsDialogOpen } from '@/project/run_configuration/ui/run_configurations_dialog_open.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import type { GameProcessAction } from '@/project/process/game_process_types.js';
import { projectWorkbenchActionIsAvailable } from '@/project/workbench/project_workbench_action_availability.js';

/** Labels of the game actions in the Run menu. */
const SHELL_MENU_RUN_GAME_ACTIONS: ReadonlyArray<{ action: GameProcessAction; label: string }> = [
  { action: 'launch', label: 'Launch Game' },
  { action: 'rebuild', label: 'Rebuild Game' },
  { action: 'restart', label: 'Restart Game' },
  { action: 'stop', label: 'Stop Game' },
];

/** Run menu: play mode, the game of the open project and the live game preview. */
export class ShellMenuRun extends ShellMenu {
  readonly label = 'Run';

  /**
   * Builds the Run menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    return [
      this.actionEntry(context, 'Play', () => context.windowActions.playStart(), { shortcutAction: 'play_start' }),
      ...this.runConfigurationEntriesBuild(context),
      this.separatorEntry(),
      ...this.gameActionEntriesBuild(context),
      this.levelBuildEntryBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Game Preview', () => context.toolbarActions.onRevealGamePreviewPanel()),
    ];
  }

  /**
   * Builds one entry per game action, enabled only where the action fits.
   *
   * @param context Actions and docks the entries run.
   * @returns Game action entries.
   */
  private gameActionEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return SHELL_MENU_RUN_GAME_ACTIONS.map(({ action, label }) =>
      this.actionEntry(context, label, () => void actions.gameProjectWorkbenchRead().actionRun(action), {
        isEnabled: () => projectWorkbenchActionIsAvailable(actions.gameProjectWorkbenchRead().statusRead(), action),
      }),
    );
  }

  /**
   * Builds the run configuration entries: run the active one (F9), run any one,
   * pick the active one, and edit them (Shift+F9).
   *
   * @param context Actions and docks.
   * @returns Menu entries.
   */
  private runConfigurationEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const runConfigurationsRead = () => context.toolbarActions.gameProjectWorkbenchRead().runConfigurationsRead();
    const isProjectOpen = () => context.toolbarActions.gameProjectWorkbenchRead().statusRead()?.project != null;
    return [
      this.actionEntry(context, 'Run Active Configuration', () => void runConfigurationsRead().runActive(), {
        shortcutAction: 'game_play_level',
        isEnabled: isProjectOpen,
      }),
      this.runConfigurationSubmenuBuild(context, 'Run Configuration', (configuration) => ({
        label: configuration.name,
        onClick: () => void runConfigurationsRead().run(configuration.id),
      })),
      this.runConfigurationActiveSubmenuBuild(context),
      this.actionEntry(
        context,
        'Edit Run Configurations…',
        () => void runConfigurationsDialogOpen(runConfigurationsRead()),
        {
          shortcutAction: 'run_configurations_edit',
          isEnabled: isProjectOpen,
        },
      ),
    ];
  }

  /**
   * Builds the submenu that picks the configuration F9 runs, with the active
   * one checked.
   *
   * @param context Actions and docks.
   * @returns Submenu entry.
   */
  private runConfigurationActiveSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const runConfigurationsRead = () => context.toolbarActions.gameProjectWorkbenchRead().runConfigurationsRead();
    return this.runConfigurationSubmenuBuild(context, 'Active Configuration', (configuration) => ({
      label: configuration.name,
      onClick: () => runConfigurationsRead().activeWrite(configuration.id),
      isChecked: () => runConfigurationsRead().activeRead()?.id === configuration.id,
    }));
  }

  /**
   * Builds a submenu with one entry per run configuration of the open project,
   * listed when the submenu opens.
   *
   * @param context Actions and docks.
   * @param label Submenu label.
   * @param entryCreate Builds the entry of one configuration.
   * @returns Submenu entry.
   */
  private runConfigurationSubmenuBuild(
    context: ShellMenuContext,
    label: string,
    entryCreate: (configuration: RunConfiguration) => ToolbarMenuAction,
  ): ToolbarMenuEntry {
    const configurationsRead = () =>
      context.toolbarActions.gameProjectWorkbenchRead().runConfigurationsRead().listRead();
    return {
      kind: 'submenu',
      label,
      children: [],
      childrenResolve: () => configurationsRead().map(entryCreate),
      isEnabled: () => configurationsRead().length > 0,
    };
  }

  /**
   * Builds the row that writes the open document as a level of the open
   * project.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entry, enabled while a project is open.
   */
  private levelBuildEntryBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const workbenchRead = context.toolbarActions.gameProjectWorkbenchRead;
    return this.actionEntry(context, 'Build Level', () => void workbenchRead().levelBuild(), {
      isEnabled: () => workbenchRead().statusRead()?.project != null,
    });
  }
}
