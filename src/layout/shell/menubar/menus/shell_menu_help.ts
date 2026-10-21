import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** Help menu: documentation, about, the MCP server, debug captures and sound. */
export class ShellMenuHelp extends ShellMenu {
  readonly label = 'Help';

  /**
   * Builds the Help menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      this.actionEntry(context, 'Documentation', () => actions.onOpenDocumentation()),
      this.actionEntry(context, 'About BevyBroom…', () => actions.onOpenAboutDialog()),
      this.separatorEntry(),
      this.actionEntry(context, 'MCP Server…', () => actions.onOpenMcpDialog()),
      this.actionEntry(context, 'AI Captures (Debug)…', () => actions.onToggleAiCaptureDebugPanel()),
      this.actionEntry(context, 'Editor Sounds', () => actions.onToggleAudio(), {
        isChecked: () => actions.isAudioEnabled(),
      }),
    ];
  }
}
