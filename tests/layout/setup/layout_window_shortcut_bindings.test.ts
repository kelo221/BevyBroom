import { describe, expect, it, vi } from 'vitest';
import { ManagerInput } from '@/input/manager_input.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import type { KeyboardShortcut, KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import {
  layoutWindowShortcutsDockCreate,
  layoutWindowShortcutsRegister,
  layoutWindowShortcutsWindowActionsCreate,
  type LayoutWindowShortcutDockCommands,
} from '@/layout/setup/layout_window_shortcut_bindings.js';

/**
 * Presses one shortcut on the window as a key down event.
 *
 * @param shortcut Shortcut whose key and modifiers are pressed.
 */
function shortcutPress(shortcut: KeyboardShortcut): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: shortcut.code,
      ctrlKey: shortcut.ctrl,
      shiftKey: shortcut.shift,
      altKey: shortcut.alt,
      metaKey: shortcut.meta,
      cancelable: true,
    }),
  );
}

/**
 * Presses the default shortcut of one action on the window.
 *
 * @param action Shortcut action whose default binding is pressed.
 */
function defaultShortcutPress(action: KeyboardShortcutAction): void {
  shortcutPress(createDefaultKeyboardShortcutSettings()[action]);
}

/**
 * Creates window actions whose every command is a spy.
 *
 * @returns Spy window actions.
 */
function windowActionsSpyCreate(): ShellWindowActions {
  return {
    selectAll: vi.fn(),
    selectNone: vi.fn(),
    viewCycle: vi.fn(),
    viewMaximize: vi.fn(),
    frameSelection: vi.fn(),
    frameAll: vi.fn(),
    playStart: vi.fn(),
    toolSelect: vi.fn(),
    toolActiveRead: () => EditorToolId.OBJECT,
    gridIntervalRead: () => 1,
    gridIntervalSet: vi.fn(),
    gridIntervalChangeListenerAdd: vi.fn(),
    shortcutLabelRead: () => '',
    ...windowActionsEditSpyCreate(),
  };
}

/**
 * Creates the clipboard, selection query and brush tool members of spy window
 * actions.
 *
 * @returns Spy edit members.
 */
function windowActionsEditSpyCreate(): Pick<
  ShellWindowActions,
  | 'clipboardCopy'
  | 'clipboardCut'
  | 'clipboardPaste'
  | 'clipboardPasteAtOriginalPosition'
  | 'clipboardSelectionHasObjectsIs'
  | 'selectionQueryRun'
  | 'selectionHasObjectsIs'
  | 'solidBrushToolsRead'
> {
  return {
    clipboardCopy: vi.fn(),
    clipboardCut: vi.fn(),
    clipboardPaste: vi.fn(),
    clipboardPasteAtOriginalPosition: vi.fn(),
    clipboardSelectionHasObjectsIs: () => false,
    selectionQueryRun: () => 0,
    selectionHasObjectsIs: () => false,
    solidBrushToolsRead: () => null,
  };
}

/**
 * Creates dock commands whose every command is a spy.
 *
 * @returns Spy dock commands.
 */
function dockCommandsSpyCreate(): LayoutWindowShortcutDockCommands {
  return { inspectorTabReveal: vi.fn(), inspectorToggle: vi.fn(), infoPanelToggle: vi.fn(), toolbarToggle: vi.fn() };
}

/**
 * Creates a registered keyboard handler with the window and dock shortcuts
 * bound.
 *
 * @param windowActions Window actions the shortcuts run.
 * @param dockCommands Dock commands the shortcuts run.
 * @returns Registered keyboard handler.
 */
function handlerWithWindowShortcutsCreate(
  windowActions: ShellWindowActions,
  dockCommands: LayoutWindowShortcutDockCommands,
): HandlerKeyboardShortcut {
  const handler = new HandlerKeyboardShortcut(new ManagerInput());
  handler.register();
  layoutWindowShortcutsRegister(handler, layoutWindowShortcutsWindowActionsCreate(windowActions));
  layoutWindowShortcutsRegister(handler, layoutWindowShortcutsDockCreate(dockCommands));
  return handler;
}

describe('layout window shortcut bindings', () => {
  it('starts play mode from the play shortcut and cycles the view from Space', () => {
    const windowActions = windowActionsSpyCreate();
    const handler = handlerWithWindowShortcutsCreate(windowActions, dockCommandsSpyCreate());
    defaultShortcutPress('view_cycle');
    expect(windowActions.playStart).not.toHaveBeenCalled();
    expect(windowActions.viewCycle).toHaveBeenCalledOnce();
    defaultShortcutPress('play_start');
    expect(windowActions.playStart).toHaveBeenCalledOnce();
    handler.unregister();
  });

  it('runs select all and select none from their shortcuts', () => {
    const windowActions = windowActionsSpyCreate();
    const handler = handlerWithWindowShortcutsCreate(windowActions, dockCommandsSpyCreate());
    defaultShortcutPress('select_all');
    defaultShortcutPress('select_none');
    expect(windowActions.selectAll).toHaveBeenCalledOnce();
    expect(windowActions.selectNone).toHaveBeenCalledOnce();
    handler.unregister();
  });

  it('pastes at the original position from the paste_original shortcut', () => {
    const windowActions = windowActionsSpyCreate();
    const handler = handlerWithWindowShortcutsCreate(windowActions, dockCommandsSpyCreate());
    defaultShortcutPress('paste_original');
    expect(windowActions.clipboardPasteAtOriginalPosition).toHaveBeenCalledOnce();
    expect(windowActions.clipboardPaste).not.toHaveBeenCalled();
    handler.unregister();
  });

  it('reveals each inspector tab from its shortcut', () => {
    const dockCommands = dockCommandsSpyCreate();
    const handler = handlerWithWindowShortcutsCreate(windowActionsSpyCreate(), dockCommands);
    defaultShortcutPress('inspector_map');
    defaultShortcutPress('inspector_entity');
    defaultShortcutPress('inspector_face');
    const revealedTabs = vi.mocked(dockCommands.inspectorTabReveal).mock.calls.map((call) => call[0]);
    expect(revealedTabs).toEqual(['map', 'entity', 'face']);
    handler.unregister();
  });

  it('toggles the inspector, info panel and toolbar from their shortcuts', () => {
    const dockCommands = dockCommandsSpyCreate();
    const handler = handlerWithWindowShortcutsCreate(windowActionsSpyCreate(), dockCommands);
    defaultShortcutPress('inspector_toggle');
    defaultShortcutPress('info_panel_toggle');
    defaultShortcutPress('toolbar_toggle');
    expect(dockCommands.inspectorToggle).toHaveBeenCalledOnce();
    expect(dockCommands.infoPanelToggle).toHaveBeenCalledOnce();
    expect(dockCommands.toolbarToggle).toHaveBeenCalledOnce();
    handler.unregister();
  });

  it('registers every callback it is given under its action', () => {
    const handler = new HandlerKeyboardShortcut(new ManagerInput());
    const actionCallbackSet = vi.spyOn(handler, 'actionCallbackSet');
    const callbacks = { play_start: vi.fn(), view_cycle: vi.fn() };
    layoutWindowShortcutsRegister(handler, callbacks);
    expect(actionCallbackSet).toHaveBeenCalledWith('play_start', callbacks.play_start);
    expect(actionCallbackSet).toHaveBeenCalledWith('view_cycle', callbacks.view_cycle);
    expect(actionCallbackSet).toHaveBeenCalledTimes(2);
  });
});
