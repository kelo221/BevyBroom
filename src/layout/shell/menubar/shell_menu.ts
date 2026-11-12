import type {
  ToolbarMenuAction,
  ToolbarMenuEntry,
  ToolbarMenuNativeApplicationSlot,
  ToolbarMenuNativeRole,
  ToolbarMenuTextEditCommand,
} from '@/ui/menu/menu_types.js';
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
  /** System role a native menu bar runs instead of the action. */
  readonly nativeRole?: ToolbarMenuNativeRole;
  /** Text editing command a native menu bar runs inside text fields. */
  readonly textEditCommand?: ToolbarMenuTextEditCommand;
  /** Application menu slot the row moves into in a native menu bar. */
  readonly nativeApplicationSlot?: ToolbarMenuNativeApplicationSlot;
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
   * @param options Shortcut, checked state, enablement and native menu parts.
   * @returns Menu action entry.
   */
  protected actionEntry(
    context: ShellMenuContext,
    label: string,
    onClick: () => void,
    options: ShellMenuActionOptions = {},
  ): ToolbarMenuAction {
    return {
      label,
      onClick,
      ...this.actionEntryShortcutParts(context, options),
      ...(options.isChecked ? { isChecked: options.isChecked } : {}),
      ...(options.isEnabled ? { isEnabled: options.isEnabled } : {}),
      ...(options.nativeRole ? { nativeRole: options.nativeRole } : {}),
      ...(options.textEditCommand ? { textEditCommand: options.textEditCommand } : {}),
      ...(options.nativeApplicationSlot ? { nativeApplicationSlot: options.nativeApplicationSlot } : {}),
    };
  }

  /**
   * Builds the shortcut label and key binding parts of one action row.
   *
   * @param context Actions and docks; used to read configured shortcuts.
   * @param options Shortcut action or fixed shortcut text.
   * @returns Shortcut parts of the action entry.
   */
  private actionEntryShortcutParts(
    context: ShellMenuContext,
    options: ShellMenuActionOptions,
  ): Pick<ToolbarMenuAction, 'shortcut' | 'shortcutBinding'> {
    const shortcutAction = options.shortcutAction;
    if (shortcutAction) {
      return {
        shortcut: () => context.windowActions.shortcutLabelRead(shortcutAction),
        shortcutBinding: () => context.windowActions.shortcutBindingRead(shortcutAction),
      };
    }
    return options.shortcutText ? { shortcut: options.shortcutText } : {};
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
