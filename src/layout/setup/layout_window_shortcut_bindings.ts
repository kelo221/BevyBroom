import type { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import type { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';

/** Callbacks of window level shortcut actions keyed by their settings action. */
export type LayoutWindowShortcutCallbacks = Partial<Record<KeyboardShortcutAction, () => void>>;

/** Dock commands the window shortcuts run. */
export type LayoutWindowShortcutDockCommands = Pick<
  ShellDockCommands,
  'inspectorTabReveal' | 'inspectorToggle' | 'infoPanelToggle' | 'toolbarToggle'
>;

/**
 * Registers every given callback as the handler of its shortcut action.
 *
 * @param keyboardShortcutHandler Keyboard handler receiving the callbacks.
 * @param callbacks Callbacks keyed by shortcut action.
 */
export function layoutWindowShortcutsRegister(
  keyboardShortcutHandler: HandlerKeyboardShortcut,
  callbacks: LayoutWindowShortcutCallbacks,
): void {
  for (const [action, callback] of Object.entries(callbacks) as Array<[KeyboardShortcutAction, () => void]>) {
    keyboardShortcutHandler.actionCallbackSet(action, callback);
  }
}

/**
 * Builds the callbacks of the view, play, selection and paste at original
 * position shortcuts.
 *
 * @param windowActions Main window commands.
 * @returns Shortcut callbacks keyed by action.
 */
export function layoutWindowShortcutsWindowActionsCreate(
  windowActions: ShellWindowActions,
): LayoutWindowShortcutCallbacks {
  return {
    paste_original: () => windowActions.clipboardPasteAtOriginalPosition(),
    play_start: () => windowActions.playStart(),
    view_cycle: () => windowActions.viewCycle(),
    view_maximize: () => windowActions.viewMaximize(),
    select_all: () => windowActions.selectAll(),
    select_none: () => windowActions.selectNone(),
  };
}

/**
 * Builds the callbacks of the inspector, info panel and toolbar shortcuts.
 *
 * @param dockCommands Commands that show, hide and switch the docks.
 * @returns Shortcut callbacks keyed by action.
 */
export function layoutWindowShortcutsDockCreate(
  dockCommands: LayoutWindowShortcutDockCommands,
): LayoutWindowShortcutCallbacks {
  return {
    inspector_map: () => dockCommands.inspectorTabReveal('map'),
    inspector_entity: () => dockCommands.inspectorTabReveal('entity'),
    inspector_face: () => dockCommands.inspectorTabReveal('face'),
    inspector_toggle: () => dockCommands.inspectorToggle(),
    info_panel_toggle: () => dockCommands.infoPanelToggle(),
    toolbar_toggle: () => dockCommands.toolbarToggle(),
  };
}
