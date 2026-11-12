import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';
import { PlatformWindowCloseShortcut } from '@/platform/window/platform_window_close_shortcut.js';
import { platformWindowCloseShortcutCreate } from '@/platform/window/platform_window_close_shortcut_current.js';
import { platformKeyboardModifierMapCreate } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';

/** Minimal floating window for the close shortcut. */
class TestToolWindow extends PanelFloating {
  /**
   * Creates a free floating test window.
   *
   * @param host Host element.
   */
  constructor(host: HTMLElement) {
    super(host, { corner: 'bottom-left', paddingPx: 8 });
    this.root.style.width = '100px';
    this.root.style.height = '60px';
  }
}

/**
 * Dispatches a keydown on the window.
 *
 * @param init Key and modifier flags.
 * @returns The dispatched event.
 */
function keyDown(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe('PlatformWindowCloseShortcut', () => {
  const shortcuts: PlatformWindowCloseShortcut[] = [];
  const panels: PanelFloating[] = [];

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
  });

  afterEach(() => {
    for (const shortcut of shortcuts.splice(0)) {
      shortcut.dispose();
    }
    for (const panel of panels.splice(0)) {
      panel.dispose();
    }
  });

  /**
   * Installs the macOS close shortcut on the window.
   *
   * @returns Installed shortcut.
   */
  function macShortcutInstall(): PlatformWindowCloseShortcut {
    const shortcut = new PlatformWindowCloseShortcut(platformKeyboardModifierMapCreate('mac'), () =>
      FloatingPanelStack.closeTopmostOpen(),
    );
    shortcut.installOnWindow(window);
    shortcuts.push(shortcut);
    return shortcut;
  }

  it('closes the floating window the user interacted with last on Command+W, one per press', () => {
    macShortcutInstall();
    const first = new TestToolWindow(document.body);
    const second = new TestToolWindow(document.body);
    panels.push(first, second);
    first.show();
    second.show();
    first.getRootElement().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const press = keyDown({ code: 'KeyW', key: 'w', metaKey: true });
    expect(press.defaultPrevented).toBe(true);
    expect(first.isOpen()).toBe(false);
    expect(second.isOpen()).toBe(true);
    keyDown({ code: 'KeyW', key: 'w', metaKey: true });
    expect(second.isOpen()).toBe(false);
  });

  it('leaves Command+W to the page when no window is open or the press has other modifiers', () => {
    macShortcutInstall();
    expect(keyDown({ code: 'KeyW', key: 'w', metaKey: true }).defaultPrevented).toBe(false);
    const panel = new TestToolWindow(document.body);
    panels.push(panel);
    panel.show();
    expect(keyDown({ code: 'KeyW', key: 'w', metaKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(keyDown({ code: 'KeyW', key: 'w', ctrlKey: true }).defaultPrevented).toBe(false);
    expect(keyDown({ code: 'KeyW', key: 'w' }).defaultPrevented).toBe(false);
    expect(panel.isOpen()).toBe(true);
  });

  it('does not close windows while typing in a text field', () => {
    macShortcutInstall();
    const panel = new TestToolWindow(document.body);
    panels.push(panel);
    panel.show();
    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'KeyW', key: 'w', metaKey: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(panel.isOpen()).toBe(true);
    input.remove();
  });

  it('exists on macOS only; Windows and Linux keep Control+W for the page', () => {
    const closeTopmost = vi.fn(() => true);
    expect(platformWindowCloseShortcutCreate('mac', closeTopmost)).toBeInstanceOf(PlatformWindowCloseShortcut);
    expect(platformWindowCloseShortcutCreate('windows', closeTopmost)).toBeNull();
    expect(platformWindowCloseShortcutCreate('linux', closeTopmost)).toBeNull();
    expect(platformWindowCloseShortcutCreate('other', closeTopmost)).toBeNull();
  });

  it('matches W by produced character so QWERTZ and AZERTY layouts close windows too', () => {
    const shortcut = new PlatformWindowCloseShortcut(platformKeyboardModifierMapCreate('mac'), () => true);
    expect(shortcut.shortcutIs(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'w', metaKey: true }))).toBe(true);
    expect(shortcut.shortcutIs(new KeyboardEvent('keydown', { code: 'KeyW', key: 'z', metaKey: true }))).toBe(false);
  });
});
