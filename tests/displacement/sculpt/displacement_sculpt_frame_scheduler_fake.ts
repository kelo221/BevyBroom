import type { DisplacementSculptFrameScheduler } from '@/displacement/sculpt/displacement_sculpt_stroke_repeater.js';

/** Frame scheduler for tests that runs pending frames only when told to. */
export class DisplacementSculptFrameSchedulerFake implements DisplacementSculptFrameScheduler {
  private readonly pending = new Map<number, () => void>();
  private nextHandle = 1;

  /**
   * Stores a frame callback until the next frame runs.
   *
   * @param callback Frame callback.
   * @returns Handle of the request.
   */
  frameRequest(callback: () => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.pending.set(handle, callback);
    return handle;
  }

  /**
   * Drops a pending frame callback.
   *
   * @param handle Handle of the request.
   */
  frameCancel(handle: number): void {
    this.pending.delete(handle);
  }

  /**
   * Runs every callback pending now, once per frame, for some frames.
   *
   * @param frameCount Number of frames to run.
   */
  framesRun(frameCount: number): void {
    for (let frame = 0; frame < frameCount; frame++) {
      const callbacks = [...this.pending.values()];
      this.pending.clear();
      callbacks.forEach((callback) => callback());
    }
  }

  /**
   * Returns how many frame callbacks are waiting.
   *
   * @returns Pending request count.
   */
  pendingCount(): number {
    return this.pending.size;
  }
}
