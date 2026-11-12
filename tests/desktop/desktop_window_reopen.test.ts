import { describe, expect, it, vi } from 'vitest';
import { desktopWindowReopenHandle, type ReopenDesktopWindow } from '@/desktop/desktop_window_reopen.js';

/**
 * Builds a fake native window that records calls.
 *
 * @param isMinimized Whether the window reports itself minimized.
 * @returns Fake window with spies.
 */
function reopenWindowCreate(isMinimized: boolean): ReopenDesktopWindow {
  return { isMinimized: () => isMinimized, unminimize: vi.fn<() => void>(), show: vi.fn<() => void>() };
}

describe('desktopWindowReopenHandle', () => {
  it('shows a hidden window again when the Dock icon is clicked', () => {
    const desktopWindow = reopenWindowCreate(false);
    expect(desktopWindowReopenHandle(desktopWindow, false)).toBe('shown');
    expect(desktopWindow.show).toHaveBeenCalledOnce();
    expect(desktopWindow.unminimize).not.toHaveBeenCalled();
  });

  it('restores a minimized window before showing it', () => {
    const desktopWindow = reopenWindowCreate(true);
    expect(desktopWindowReopenHandle(desktopWindow, false)).toBe('unminimized');
    expect(desktopWindow.unminimize).toHaveBeenCalledOnce();
    expect(desktopWindow.show).toHaveBeenCalledOnce();
  });

  it('never shows a window the launch keeps hidden', () => {
    const desktopWindow = reopenWindowCreate(true);
    expect(desktopWindowReopenHandle(desktopWindow, true)).toBe('kept_hidden');
    expect(desktopWindow.unminimize).not.toHaveBeenCalled();
    expect(desktopWindow.show).not.toHaveBeenCalled();
  });
});
