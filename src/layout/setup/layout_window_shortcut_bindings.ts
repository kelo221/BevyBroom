import type { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import type { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import type { ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** Callbacks of window level shortcut actions keyed by their settings action. */
export type LayoutWindowShortcutCallbacks = Partial<Record<KeyboardShortcutAction, () => void>>;

/** Dock commands the window shortcuts run. */
export type LayoutWindowShortcutDockCommands = Pick<
  ShellDockCommands,
  'inspectorReveal' | 'inspectorToggle' | 'infoPanelToggle' | 'infoPanelCollapsedToggle' | 'toolbarToggle'
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
 * Builds the callbacks of the view, play, selection, Object Properties, paste
 * at original position and Sprinkle tool shortcuts.
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
    visibility_hide: () => windowActions.selectionVisibilityRead()?.hideSelected(),
    visibility_isolate: () => windowActions.selectionVisibilityRead()?.isolateSelected(),
    visibility_show_all: () => windowActions.selectionVisibilityRead()?.showAll(),
    object_properties: () => windowActions.objectPropertiesOpen(),
    tool_sprinkle: () => windowActions.toolSelect(EditorToolId.SPRINKLE),
    tool_vertex: () => windowActions.toolSelect(EditorToolId.VERTEX),
  };
}

/**
 * Builds the callbacks of the inspector, info panel, info panel collapse and
 * toolbar shortcuts.
 *
 * @param dockCommands Commands that show, hide and switch the docks.
 * @returns Shortcut callbacks keyed by action.
 */
export function layoutWindowShortcutsDockCreate(
  dockCommands: LayoutWindowShortcutDockCommands,
): LayoutWindowShortcutCallbacks {
  return {
    inspector_map: () => dockCommands.inspectorReveal(),
    inspector_toggle: () => dockCommands.inspectorToggle(),
    info_panel_toggle: () => dockCommands.infoPanelToggle(),
    info_panel_collapse_toggle: () => dockCommands.infoPanelCollapsedToggle(),
    toolbar_toggle: () => dockCommands.toolbarToggle(),
  };
}

/**
 * Builds the callbacks of the command search and the Edit > CSG brush operation
 * shortcuts.
 *
 * @param menuContext Actions the main window menus run.
 * @param commandSearchOpen Opens the command search.
 * @returns Shortcut callbacks keyed by action.
 */
export function layoutWindowShortcutsCommandsCreate(
  menuContext: Pick<ShellMenuContext, 'toolbarActions' | 'windowActions'>,
  commandSearchOpen: () => void,
): LayoutWindowShortcutCallbacks {
  const actions = menuContext.toolbarActions;
  const brushToolsRead = () => menuContext.windowActions.solidBrushToolsRead();
  return {
    command_search: commandSearchOpen,
    csg_union: () => actions.onCsgUnion(),
    csg_subtract: () => actions.onCsgSubtract(),
    csg_intersect: () => actions.onCsgIntersect(),
    csg_hollow: () => brushToolsRead()?.hollow(),
    csg_convex_merge: () => brushToolsRead()?.convexMerge(),
  };
}
