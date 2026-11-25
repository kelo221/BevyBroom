import { describe, expect, it } from 'vitest';
import { RenderDemandInputWatcher } from '@/layout/render_demand/render_demand_input_watcher.js';
import {
  RenderDemandTestClock,
  renderDemandTestKeyDispatch,
  renderDemandTestPointerDispatch,
  renderDemandTestWindowCreate,
} from './render_demand_test_helpers.js';

/**
 * RenderDemandInputWatcher reports when the user last acted on a window and
 * whether a pointer button or key is still held, so the editor knows when it
 * must keep drawing its views.
 */
describe('RenderDemandInputWatcher', () => {
  it('records the time of the latest input event', () => {
    const clock = new RenderDemandTestClock(1000);
    const watchedWindow = renderDemandTestWindowCreate();
    const watcher = new RenderDemandInputWatcher(watchedWindow, clock.nowMs);
    clock.advance(500);
    renderDemandTestPointerDispatch(watchedWindow, 'pointermove', 1);
    expect(watcher.lastInputAtMsRead()).toBe(clock.nowMs());
    watcher.dispose();
  });

  it('holds a pointer from press until release', () => {
    const watchedWindow = renderDemandTestWindowCreate();
    const watcher = new RenderDemandInputWatcher(watchedWindow, new RenderDemandTestClock(0).nowMs);
    renderDemandTestPointerDispatch(watchedWindow, 'pointerdown', 7);
    expect(watcher.isAnythingHeld()).toBe(true);
    renderDemandTestPointerDispatch(watchedWindow, 'pointerup', 7);
    expect(watcher.isAnythingHeld()).toBe(false);
    watcher.dispose();
  });

  it('holds a key from key down until key up', () => {
    const watchedWindow = renderDemandTestWindowCreate();
    const watcher = new RenderDemandInputWatcher(watchedWindow, new RenderDemandTestClock(0).nowMs);
    renderDemandTestKeyDispatch(watchedWindow, 'keydown', 'KeyW');
    expect(watcher.isAnythingHeld()).toBe(true);
    renderDemandTestKeyDispatch(watchedWindow, 'keyup', 'KeyW');
    expect(watcher.isAnythingHeld()).toBe(false);
    watcher.dispose();
  });

  it('forgets held input when the window loses focus', () => {
    const watchedWindow = renderDemandTestWindowCreate();
    const watcher = new RenderDemandInputWatcher(watchedWindow, new RenderDemandTestClock(0).nowMs);
    renderDemandTestPointerDispatch(watchedWindow, 'pointerdown', 2);
    renderDemandTestKeyDispatch(watchedWindow, 'keydown', 'ShiftLeft');
    watchedWindow.dispatchEvent(new Event('blur'));
    expect(watcher.isAnythingHeld()).toBe(false);
    watcher.dispose();
  });

  it('ignores the window after dispose', () => {
    const clock = new RenderDemandTestClock(0);
    const watchedWindow = renderDemandTestWindowCreate();
    const watcher = new RenderDemandInputWatcher(watchedWindow, clock.nowMs);
    const timeBeforeDispose = watcher.lastInputAtMsRead();
    watcher.dispose();
    clock.advance(100);
    renderDemandTestPointerDispatch(watchedWindow, 'pointerdown', 3);
    expect(watcher.isAnythingHeld()).toBe(false);
    expect(watcher.lastInputAtMsRead()).toBe(timeBeforeDispose);
  });
});
