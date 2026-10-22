import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
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
      this.separatorEntry(),
      ...this.gameActionEntriesBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Game Preview…', () => context.toolbarActions.onToggleGamePreviewPanel()),
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
}
