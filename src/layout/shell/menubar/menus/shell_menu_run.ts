import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** Run menu: play mode and the live game preview. */
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
      this.actionEntry(context, 'Game Preview…', () => context.toolbarActions.onToggleGamePreviewPanel()),
    ];
  }
}
