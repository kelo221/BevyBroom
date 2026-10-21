import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { issueCreate, type Issue } from '@/info_panel/issues/issue.js';
import { ISSUES_SCHEDULER_DELAY_MILLISECONDS, IssuesScheduler } from '@/info_panel/issues/issues_scheduler.js';

/** A scheduler over a counting collector and a manual change source. */
interface SchedulerRig {
  scheduler: IssuesScheduler;
  collectCalls: { count: number };
  changeFire: () => void;
  subscriberCount: () => number;
}

/**
 * Builds a scheduler whose collector counts its runs and reports one issue per
 * run so far.
 *
 * @returns The rig.
 */
function rigCreate(): SchedulerRig {
  const collectCalls = { count: 0 };
  const listeners = new Set<() => void>();
  const scheduler = new IssuesScheduler({
    worldGroup: new THREE.Group(),
    changeSubscribes: [
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    ],
    issuesCollect: (): Issue[] => {
      collectCalls.count += 1;
      return [issueCreate('test', { severity: 'warning', objectUuid: null, objectName: '', description: 'run' })];
    },
  });
  return {
    scheduler,
    collectCalls,
    changeFire: () => listeners.forEach((listener) => listener()),
    subscriberCount: () => listeners.size,
  };
}

/**
 * Unit tests for the issues scheduler: one validation a quiet time after the
 * last change, immediate validation on request, and clean disposal.
 */
describe('IssuesScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates once after creation when the quiet time passed', () => {
    const rig = rigCreate();
    expect(rig.collectCalls.count).toBe(0);
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS);
    expect(rig.collectCalls.count).toBe(1);
    expect(rig.scheduler.issuesRead().length).toBe(1);
    rig.scheduler.dispose();
  });

  it('waits for the quiet time after the last of many quick changes', () => {
    const rig = rigCreate();
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS);
    const step = ISSUES_SCHEDULER_DELAY_MILLISECONDS / 5;
    for (let change = 0; change < 10; change += 1) {
      rig.changeFire();
      vi.advanceTimersByTime(step);
    }
    expect(rig.collectCalls.count).toBe(1);
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS);
    expect(rig.collectCalls.count).toBe(2);
    rig.scheduler.dispose();
  });

  it('tells listeners the new issues and validates right away on request', () => {
    const rig = rigCreate();
    const received: Array<readonly Issue[]> = [];
    rig.scheduler.changeListenerAdd((issues) => received.push(issues));
    const issues = rig.scheduler.validationRunNow();
    expect(received).toEqual([issues]);
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS * 2);
    expect(rig.collectCalls.count).toBe(1);
    rig.scheduler.dispose();
  });

  it('stops listening and cancels the pending run when disposed', () => {
    const rig = rigCreate();
    rig.scheduler.dispose();
    rig.changeFire();
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS * 2);
    expect(rig.collectCalls.count).toBe(0);
    expect(rig.subscriberCount()).toBe(0);
  });

  it('uses an injected timer source', () => {
    const pending: Array<() => void> = [];
    const scheduler = new IssuesScheduler({
      worldGroup: new THREE.Group(),
      changeSubscribes: [],
      timerSource: {
        timeoutSet: (callback) => pending.push(callback),
        timeoutClear: () => undefined,
      },
      issuesCollect: () => [],
    });
    const listener = vi.fn();
    scheduler.changeListenerAdd(listener);
    pending.forEach((callback) => callback());
    expect(listener).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });
});
