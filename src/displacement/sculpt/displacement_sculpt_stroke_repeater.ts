import type * as THREE from 'three';

/** Schedules callbacks for the next animation frame. */
export interface DisplacementSculptFrameScheduler {
  /**
   * Runs a callback on the next frame.
   *
   * @param callback Frame callback.
   * @returns Handle that cancels the request.
   */
  frameRequest(callback: () => void): number;
  /**
   * Cancels a pending frame request.
   *
   * @param handle Handle returned by frameRequest.
   */
  frameCancel(handle: number): void;
}

/**
 * Creates a frame scheduler backed by the browser's animation frames, or by
 * timers where animation frames do not exist.
 *
 * @returns Frame scheduler.
 */
export function displacementSculptFrameSchedulerBrowserCreate(): DisplacementSculptFrameScheduler {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return {
      frameRequest: (callback) => globalThis.requestAnimationFrame(() => callback()),
      frameCancel: (handle) => globalThis.cancelAnimationFrame(handle),
    };
  }
  return {
    frameRequest: (callback) => Number(globalThis.setTimeout(callback, 16)),
    frameCancel: (handle) => globalThis.clearTimeout(handle),
  };
}

/**
 * Re-applies the last dab center every animation frame while running, so a held
 * but motionless pointer keeps painting (Continuous Mouse).
 */
export class DisplacementSculptStrokeRepeater {
  private center: THREE.Vector3 | null = null;
  private frameHandle: number | null = null;

  /**
   * Creates a stopped repeater.
   *
   * @param scheduler Frame scheduler driving the repeats.
   * @param dabRepeat Paints one dab at a world center.
   */
  constructor(
    private readonly scheduler: DisplacementSculptFrameScheduler,
    private readonly dabRepeat: (center: THREE.Vector3) => void,
  ) {}

  /**
   * Starts repeating dabs at a center; restarts when already running.
   *
   * @param center World-space dab center.
   */
  start(center: THREE.Vector3): void {
    this.stop();
    this.center = center.clone();
    this.frameSchedule();
  }

  /**
   * Moves the repeated dab center while running.
   *
   * @param center New world-space dab center.
   */
  centerUpdate(center: THREE.Vector3): void {
    if (this.center) {
      this.center.copy(center);
    }
  }

  /** Stops repeating and cancels the pending frame. */
  stop(): void {
    if (this.frameHandle !== null) {
      this.scheduler.frameCancel(this.frameHandle);
    }
    this.frameHandle = null;
    this.center = null;
  }

  /**
   * Returns whether dabs are being repeated.
   *
   * @returns True between start and stop.
   */
  isRunning(): boolean {
    return this.center !== null;
  }

  /** Requests the next repeat frame. */
  private frameSchedule(): void {
    this.frameHandle = this.scheduler.frameRequest(() => this.frameRun());
  }

  /** Paints one dab at the current center and schedules the next frame. */
  private frameRun(): void {
    this.frameHandle = null;
    const center = this.center;
    if (!center) {
      return;
    }
    this.dabRepeat(center);
    if (this.center) {
      this.frameSchedule();
    }
  }
}
