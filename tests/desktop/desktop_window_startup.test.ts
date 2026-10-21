import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY,
  desktopWindowHiddenRequested,
  showMaximizedWhenReady,
} from '@/desktop/desktop_window_startup.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Builds a fake window whose webview reports ready when `ready.notify` runs.
 *
 * @returns The fake window, its maximize and show spies, and the ready trigger.
 */
function fakeWindowCreate() {
  const ready = { notify: (): void => {} };
  const maximize = vi.fn();
  const show = vi.fn();
  const webview = {
    on: vi.fn((_name: 'dom-ready', handler: () => void) => {
      ready.notify = handler;
    }),
  };
  return { window: { maximize, show, webview }, maximize, show, ready };
}

describe('desktop window startup', () => {
  it('waits for the webview before maximizing and showing the window', () => {
    const { window, maximize, show, ready } = fakeWindowCreate();
    const afterShown = vi.fn();
    showMaximizedWhenReady(window, afterShown);

    expect(maximize).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(afterShown).not.toHaveBeenCalled();
    ready.notify();
    expect(maximize).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
    expect(afterShown).toHaveBeenCalledOnce();
    expect(maximize.mock.invocationCallOrder[0]!).toBeLessThan(show.mock.invocationCallOrder[0]!);
    expect(show.mock.invocationCallOrder[0]!).toBeLessThan(afterShown.mock.invocationCallOrder[0]!);
  });

  it('keeps a window hidden when asked but still runs the ready work', () => {
    const fake = fakeWindowCreate();
    const afterReady = vi.fn();
    showMaximizedWhenReady(fake.window, afterReady, true);
    fake.ready.notify();
    expect(fake.maximize).not.toHaveBeenCalled();
    expect(fake.show).not.toHaveBeenCalled();
    expect(afterReady).toHaveBeenCalledOnce();
  });

  it('keeps the window hidden only when the environment variable is 1', () => {
    expect(desktopWindowHiddenRequested({ [DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY]: '1' })).toBe(true);
    expect(desktopWindowHiddenRequested({ [DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY]: '0' })).toBe(false);
    expect(desktopWindowHiddenRequested({})).toBe(false);
  });

  it('passes the hidden request of the environment to the desktop entry startup', () => {
    const bunEntry = readFileSync(resolve(process.cwd(), 'src/desktop/bun/index.ts'), 'utf8');
    expect(bunEntry).toContain('desktopWindowHiddenRequested(process.env)');
  });
});
