import type { ToolbarMenuAction, ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { EditorToolbarActions } from '@/layout/shell/builder_editor_shell.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import type { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';

/** Everything a main window menu needs to build its entries. */
export interface ShellMenuContext {
  readonly toolbarActions: EditorToolbarActions;
  readonly windowActions: ShellWindowActions;
  readonly dockCommands: ShellDockCommands;
}

/** Optional parts of one menu action row. */
export interface ShellMenuActionOptions {
  /** Shortcut action whose configured key is shown on the right. */
  readonly shortcutAction?: KeyboardShortcutAction;
  /**
   * Fixed shortcut text for keys that cannot be rebound; ignored with a
   * shortcut action.
   */
  readonly shortcutText?: string;
  /** Live checked state. */
  readonly isChecked?: () => boolean;
  /** Live enablement. */
  readonly isEnabled?: () => boolean;
}

/** One top-level menu of the main window menu bar. */
export abstract class ShellMenu {
  /** Menu header text. */
  abstract readonly label: string;

  /**
   * Builds the menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries in display order.
   */
  abstract entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[];

  /**
   * Builds one action row.
   *
   * @param context Actions and docks; used for shortcut labels.
   * @param label Row text.
   * @param onClick Function run when the row is chosen.
   * @param options Shortcut, checked state and enablement.
   * @returns Menu action entry.
   */
  protected actionEntry(
    context: ShellMenuContext,
    label: string,
    onClick: () => void,
    options: ShellMenuActionOptions = {},
  ): ToolbarMenuAction {
    const shortcutAction = options.shortcutAction;
    const shortcut = shortcutAction
      ? () => context.windowActions.shortcutLabelRead(shortcutAction)
      : options.shortcutText;
    return {
      label,
      onClick,
      ...(shortcut ? { shortcut } : {}),
      ...(options.isChecked ? { isChecked: options.isChecked } : {}),
      ...(options.isEnabled ? { isEnabled: options.isEnabled } : {}),
    };
  }

  /**
   * Returns a separator entry.
   *
   * @returns Separator entry.
   */
  protected separatorEntry(): ToolbarMenuEntry {
    return { kind: 'separator' };
  }
}
