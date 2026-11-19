import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORKSPACE_CAMERA_PERSISTENCE_DELAY_MS,
  WorkspaceCameraPersistence,
} from '@/layout/workspace/workspace_camera_persistence.js';

/**
 * Starts camera persistence on a fresh viewport area of the test window.
 *
 * @returns Persistence, its viewport area and the save mock.
 */
function persistenceStart(): { persistence: WorkspaceCameraPersistence; area: HTMLElement; persist: () => void } {
  const area = document.createElement('div');
  const persist = vi.fn();
  const persistence = new WorkspaceCameraPersistence({ viewportArea: area, windowObject: window, persist });
  return { persistence, area, persist };
}

/**
 * The workspace is saved with its cameras once camera input goes quiet and
 * whenever the window loses focus or closes, so a quit without unload events
 * still keeps the views.
 */
describe('WorkspaceCameraPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves once after orbiting, zooming and flying stop', () => {
    const { persistence, area, persist } = persistenceStart();
    area.dispatchEvent(new Event('pointerup'));
    area.dispatchEvent(new Event('wheel'));
    window.dispatchEvent(new Event('keyup'));
    vi.advanceTimersByTime(WORKSPACE_CAMERA_PERSISTENCE_DELAY_MS - 1);
    expect(persist).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(persist).toHaveBeenCalledOnce();
    persistence.dispose();
  });

  it('saves at once when the window loses focus or closes', () => {
    const { persistence, area, persist } = persistenceStart();
    area.dispatchEvent(new Event('wheel'));
    window.dispatchEvent(new Event('blur'));
    expect(persist).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('pagehide'));
    expect(persist).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(WORKSPACE_CAMERA_PERSISTENCE_DELAY_MS);
    expect(persist).toHaveBeenCalledTimes(2);
    persistence.dispose();
  });

  it('stops saving after dispose and drops a pending save', () => {
    const { persistence, area, persist } = persistenceStart();
    area.dispatchEvent(new Event('pointerup'));
    persistence.dispose();
    vi.advanceTimersByTime(WORKSPACE_CAMERA_PERSISTENCE_DELAY_MS);
    window.dispatchEvent(new Event('blur'));
    expect(persist).not.toHaveBeenCalled();
  });
});
