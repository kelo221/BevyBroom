import type * as THREE from 'three';
import { RenderDemandInputWatcher } from '@/layout/render_demand/render_demand_input_watcher.js';
import { RenderDemandViewSignature } from '@/layout/render_demand/render_demand_view_signature.js';

/** Timing rules that decide when an idle editor still draws its views. */
export interface RenderDemandSchedulerTiming {
  /**
   * How long every frame is drawn after the last input or request, in
   * milliseconds.
   */
  readonly inputLingerMs: number;
  /** Longest time an idle editor waits between two drawings, in milliseconds. */
  readonly idleRedrawIntervalMs: number;
}

/**
 * Default timing: a short linger after input and four drawings a second while
 * idle.
 */
export const RENDER_DEMAND_SCHEDULER_TIMING_DEFAULT: RenderDemandSchedulerTiming = {
  inputLingerMs: 300,
  idleRedrawIntervalMs: 250,
};

/**
 * Decides, once per animation frame, whether the views must be drawn: while the
 * user interacts with any watched window, while a view moves, right after a
 * request, and at a slow steady pace otherwise so changes without input still
 * appear.
 */
export class RenderDemandScheduler {
  private readonly inputWatchers: Map<Window, RenderDemandInputWatcher>;
  private readonly viewSignature: RenderDemandViewSignature;
  private readonly timing: RenderDemandSchedulerTiming;
  private readonly nowMs: () => number;
  private lastDrawnAtMs: number;
  private lastRequestAtMs: number;

  /**
   * Creates a scheduler watching the given window.
   *
   * @param watchedWindow Window whose input keeps the views drawing.
   * @param nowMs Clock returning the current time in milliseconds.
   * @param timing Linger and idle redraw timing.
   */
  constructor(watchedWindow: Window, nowMs: () => number, timing: RenderDemandSchedulerTiming) {
    this.inputWatchers = new Map();
    this.viewSignature = new RenderDemandViewSignature();
    this.timing = timing;
    this.nowMs = nowMs;
    this.lastDrawnAtMs = Number.NEGATIVE_INFINITY;
    this.lastRequestAtMs = nowMs();
    this.windowWatchAdd(watchedWindow);
  }

  /**
   * Starts treating input on another window, such as a popup viewport, like
   * input on the main window.
   *
   * @param watchedWindow Window to watch; watching it twice has no effect.
   */
  windowWatchAdd(watchedWindow: Window): void {
    if (this.inputWatchers.has(watchedWindow)) {
      return;
    }
    this.inputWatchers.set(watchedWindow, new RenderDemandInputWatcher(watchedWindow, this.nowMs));
    this.request();
  }

  /**
   * Stops watching a window added with {@link windowWatchAdd}.
   *
   * @param watchedWindow Window to stop watching.
   */
  windowWatchRemove(watchedWindow: Window): void {
    this.inputWatchers.get(watchedWindow)?.dispose();
    this.inputWatchers.delete(watchedWindow);
    this.request();
  }

  /**
   * Asks for the views to be drawn on the next frames, as if the user had just
   * acted.
   */
  request(): void {
    this.lastRequestAtMs = this.nowMs();
  }

  /**
   * Returns whether this frame must draw the views showing the given cameras.
   *
   * @param cameras Cameras of the views about to be drawn, in pane order.
   * @returns True when the frame must draw.
   */
  isDrawNeeded(cameras: readonly THREE.Camera[]): boolean {
    const now = this.nowMs();
    return (
      this.isAnyInputHeld() ||
      now - this.lastActivityAtMsRead() <= this.timing.inputLingerMs ||
      now - this.lastDrawnAtMs >= this.timing.idleRedrawIntervalMs ||
      this.viewSignature.isChanged(cameras)
    );
  }

  /**
   * Records that the views showing the given cameras were just drawn.
   *
   * @param cameras Cameras of the views that were drawn, in pane order.
   */
  drawnRecord(cameras: readonly THREE.Camera[]): void {
    this.lastDrawnAtMs = this.nowMs();
    this.viewSignature.record(cameras);
  }

  /** Stops watching every window. */
  dispose(): void {
    this.inputWatchers.forEach((watcher) => watcher.dispose());
    this.inputWatchers.clear();
  }

  /**
   * Returns whether a pointer button or key is held in any watched window.
   *
   * @returns True while something is held.
   */
  private isAnyInputHeld(): boolean {
    for (const watcher of this.inputWatchers.values()) {
      if (watcher.isAnythingHeld()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the latest time of a request or of input on any watched window.
   *
   * @returns Milliseconds on the scheduler's clock.
   */
  private lastActivityAtMsRead(): number {
    let latestMs = this.lastRequestAtMs;
    this.inputWatchers.forEach((watcher) => {
      latestMs = Math.max(latestMs, watcher.lastInputAtMsRead());
    });
    return latestMs;
  }
}
