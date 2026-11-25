import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  RENDER_DEMAND_SCHEDULER_TIMING_DEFAULT,
  RenderDemandScheduler,
} from '@/layout/render_demand/render_demand_scheduler.js';
import {
  RenderDemandTestClock,
  renderDemandTestPointerDispatch,
  renderDemandTestWindowCreate,
} from './render_demand_test_helpers.js';

/**
 * RenderDemandScheduler draws the views while the user acts, while a view moves
 * and on request, and only at a slow steady pace while the editor idles.
 */
describe('RenderDemandScheduler', () => {
  const timing = RENDER_DEMAND_SCHEDULER_TIMING_DEFAULT;

  /**
   * Creates a scheduler that has drawn once and then idled past the input
   * linger.
   *
   * @returns The idle scheduler, its window, clock and cameras.
   */
  function idleSchedulerCreate(): {
    scheduler: RenderDemandScheduler;
    watchedWindow: Window;
    clock: RenderDemandTestClock;
    cameras: THREE.Camera[];
  } {
    const clock = new RenderDemandTestClock(10_000);
    const watchedWindow = renderDemandTestWindowCreate();
    const scheduler = new RenderDemandScheduler(watchedWindow, clock.nowMs, timing);
    const cameras: THREE.Camera[] = [new THREE.PerspectiveCamera()];
    clock.advance(timing.inputLingerMs + 1);
    scheduler.drawnRecord(cameras);
    return { scheduler, watchedWindow, clock, cameras };
  }

  it('draws every frame right after it is created', () => {
    const clock = new RenderDemandTestClock(0);
    const scheduler = new RenderDemandScheduler(renderDemandTestWindowCreate(), clock.nowMs, timing);
    const cameras = [new THREE.PerspectiveCamera()];
    scheduler.drawnRecord(cameras);
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    scheduler.dispose();
  });

  it('skips frames while idle and draws again once the idle interval passes', () => {
    const { scheduler, clock, cameras } = idleSchedulerCreate();
    expect(scheduler.isDrawNeeded(cameras)).toBe(false);
    clock.advance(timing.idleRedrawIntervalMs);
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    scheduler.dispose();
  });

  it('draws after input and stops once the linger time passes', () => {
    const { scheduler, watchedWindow, clock, cameras } = idleSchedulerCreate();
    renderDemandTestPointerDispatch(watchedWindow, 'pointermove', 1);
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    scheduler.drawnRecord(cameras);
    clock.advance(timing.inputLingerMs + 1);
    scheduler.drawnRecord(cameras);
    expect(scheduler.isDrawNeeded(cameras)).toBe(false);
    scheduler.dispose();
  });

  it('keeps drawing while a pointer button is held without moving', () => {
    const { scheduler, watchedWindow, clock, cameras } = idleSchedulerCreate();
    renderDemandTestPointerDispatch(watchedWindow, 'pointerdown', 1);
    clock.advance(timing.inputLingerMs * 10);
    scheduler.drawnRecord(cameras);
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    renderDemandTestPointerDispatch(watchedWindow, 'pointerup', 1);
    clock.advance(timing.inputLingerMs + 1);
    scheduler.drawnRecord(cameras);
    expect(scheduler.isDrawNeeded(cameras)).toBe(false);
    scheduler.dispose();
  });

  it('draws when a view moves without any input', () => {
    const { scheduler, cameras } = idleSchedulerCreate();
    cameras[0]?.position.set(1, 2, 3);
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    scheduler.dispose();
  });

  it('treats input on an added popup window like input on the main window until it is removed', () => {
    const { scheduler, clock, cameras } = idleSchedulerCreate();
    const popupWindow = renderDemandTestWindowCreate();
    scheduler.windowWatchAdd(popupWindow);
    clock.advance(timing.inputLingerMs + 1);
    scheduler.drawnRecord(cameras);
    renderDemandTestPointerDispatch(popupWindow, 'pointerdown', 4);
    clock.advance(timing.inputLingerMs * 10);
    scheduler.drawnRecord(cameras);
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    scheduler.windowWatchRemove(popupWindow);
    clock.advance(timing.inputLingerMs + 1);
    scheduler.drawnRecord(cameras);
    expect(scheduler.isDrawNeeded(cameras)).toBe(false);
    scheduler.dispose();
  });

  it('draws after a request without any input', () => {
    const { scheduler, cameras } = idleSchedulerCreate();
    scheduler.request();
    expect(scheduler.isDrawNeeded(cameras)).toBe(true);
    scheduler.dispose();
  });
});
