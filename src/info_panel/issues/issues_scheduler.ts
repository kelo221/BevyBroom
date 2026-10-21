import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProviderRegistry } from '@/info_panel/issues/issue_provider_registry.js';

/** Quiet time after the last change before the map is validated again. */
export const ISSUES_SCHEDULER_DELAY_MILLISECONDS = 500;

/**
 * Subscribes a callback to changes that may change the issues.
 *
 * @param listener Runs after every change.
 * @returns Function that removes the callback.
 */
export type IssuesSchedulerChangeSubscribe = (listener: () => void) => () => void;

/** Receives the issues after every validation run. */
export type IssuesSchedulerListener = (issues: readonly Issue[]) => void;

/** Starts and cancels delayed callbacks. */
export interface IssuesSchedulerTimerSource {
  /**
   * Runs a callback once after a delay.
   *
   * @param callback Callback.
   * @param delayMilliseconds Delay.
   * @returns Handle for {@link timeoutClear}.
   */
  timeoutSet(callback: () => void, delayMilliseconds: number): unknown;
  /**
   * Cancels a pending callback.
   *
   * @param handle Handle returned by {@link timeoutSet}.
   */
  timeoutClear(handle: unknown): void;
}

/** Collaborators of an issues scheduler. */
export interface IssuesSchedulerOptions {
  /** Editor world root that is validated. */
  worldGroup: THREE.Object3D;
  /** Change sources that make the map be validated again. */
  changeSubscribes: readonly IssuesSchedulerChangeSubscribe[];
  /** Timer used for the delay; defaults to the global timers. */
  timerSource?: IssuesSchedulerTimerSource;
  /** Quiet time before validating; defaults to 500 milliseconds. */
  delayMilliseconds?: number;
  /** Finds the issues of the world; defaults to every registered provider. */
  issuesCollect?: (worldGroup: THREE.Object3D) => Issue[];
}

/** Timer source backed by the global setTimeout and clearTimeout. */
const ISSUES_SCHEDULER_TIMER_SOURCE_GLOBAL: IssuesSchedulerTimerSource = {
  timeoutSet: (callback, delayMilliseconds) => globalThis.setTimeout(callback, delayMilliseconds),
  timeoutClear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Validates the map again a short quiet time after the last change and keeps
 * the newest issues for listeners. Validation is scheduled once on creation.
 */
export class IssuesScheduler {
  private readonly worldGroup: THREE.Object3D;
  private readonly timerSource: IssuesSchedulerTimerSource;
  private readonly delayMilliseconds: number;
  private readonly issuesCollect: (worldGroup: THREE.Object3D) => Issue[];
  private readonly changeUnsubscribes: Array<() => void>;
  private readonly listeners = new Set<IssuesSchedulerListener>();
  private pendingHandle: unknown = null;
  private issues: readonly Issue[] = [];
  private isDisposed = false;

  /**
   * Creates a scheduler and schedules the first validation.
   *
   * @param options Collaborators.
   */
  constructor(options: IssuesSchedulerOptions) {
    this.worldGroup = options.worldGroup;
    this.timerSource = options.timerSource ?? ISSUES_SCHEDULER_TIMER_SOURCE_GLOBAL;
    this.delayMilliseconds = options.delayMilliseconds ?? ISSUES_SCHEDULER_DELAY_MILLISECONDS;
    this.issuesCollect = options.issuesCollect ?? ((worldGroup) => IssueProviderRegistry.issuesCollect(worldGroup));
    this.changeUnsubscribes = options.changeSubscribes.map((subscribe) => subscribe(() => this.validationSchedule()));
    this.validationSchedule();
  }

  /**
   * Returns the issues of the newest validation run.
   *
   * @returns Issues; empty before the first run.
   */
  issuesRead(): readonly Issue[] {
    return this.issues;
  }

  /**
   * Restarts the quiet time; the map is validated once it passes without
   * another change.
   */
  validationSchedule(): void {
    if (this.isDisposed) {
      return;
    }
    this.pendingCancel();
    this.pendingHandle = this.timerSource.timeoutSet(() => this.validationRunPending(), this.delayMilliseconds);
  }

  /**
   * Validates the map right away, cancelling a scheduled run.
   *
   * @returns The new issues.
   */
  validationRunNow(): readonly Issue[] {
    this.pendingCancel();
    this.issues = this.issuesCollect(this.worldGroup);
    this.listeners.forEach((listener) => listener(this.issues));
    return this.issues;
  }

  /**
   * Registers a callback run after every validation.
   *
   * @param listener Receives the new issues.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: IssuesSchedulerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Stops listening for changes and cancels a scheduled run. */
  dispose(): void {
    this.isDisposed = true;
    this.pendingCancel();
    this.changeUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }

  /** Runs the scheduled validation. */
  private validationRunPending(): void {
    this.pendingHandle = null;
    if (!this.isDisposed) {
      this.validationRunNow();
    }
  }

  /** Cancels the scheduled validation, if any. */
  private pendingCancel(): void {
    if (this.pendingHandle !== null) {
      this.timerSource.timeoutClear(this.pendingHandle);
      this.pendingHandle = null;
    }
  }
}
