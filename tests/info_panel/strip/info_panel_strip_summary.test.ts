import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { issueCreate, type Issue } from '@/info_panel/issues/issue.js';
import { IssuesScheduler, type IssuesSchedulerTimerSource } from '@/info_panel/issues/issues_scheduler.js';
import { INFO_PANEL_SEVERITY_COLOR_ERROR } from '@/info_panel/info_panel_severity.js';
import { InfoPanelStripSummary } from '@/info_panel/strip/info_panel_strip_summary.js';
import {
  INFO_PANEL_STRIP_NEWEST_LINE_CLASS,
  INFO_PANEL_STRIP_PULSE_MILLISECONDS,
} from '@/info_panel/strip/info_panel_strip_styles.js';
import { ShellDockPanelsMount } from '@/layout/shell/mount/shell_dock_panels_mount.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import {
  shellTestDocksCreate,
  shellTestDocksDispose,
  type ShellTestDocks,
} from '../../layout/shell/shell_test_support.js';
import { layerTestWorldCreate } from '../../layer/layer_test_world.js';
import { uiTestCssColorNormalize } from '../../ui/ui_test_css_color.js';

/** Timer whose callbacks run only when the test advances it. */
class InfoPanelStripTestTimer implements IssuesSchedulerTimerSource {
  private nowMilliseconds = 0;
  private nextHandle = 1;
  private readonly pending = new Map<number, { dueMilliseconds: number; callback: () => void }>();

  /**
   * Stores a callback due after a delay.
   *
   * @param callback Callback.
   * @param delayMilliseconds Delay.
   * @returns Handle of the stored callback.
   */
  timeoutSet(callback: () => void, delayMilliseconds: number): unknown {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.pending.set(handle, { dueMilliseconds: this.nowMilliseconds + delayMilliseconds, callback });
    return handle;
  }

  /**
   * Drops a stored callback.
   *
   * @param handle Handle returned by timeoutSet.
   */
  timeoutClear(handle: unknown): void {
    this.pending.delete(handle as number);
  }

  /**
   * Moves time forward and runs every callback that became due.
   *
   * @param milliseconds Time to pass.
   */
  advance(milliseconds: number): void {
    this.nowMilliseconds += milliseconds;
    [...this.pending.entries()]
      .filter(([, entry]) => entry.dueMilliseconds <= this.nowMilliseconds)
      .forEach(([handle, entry]) => {
        this.pending.delete(handle);
        entry.callback();
      });
  }
}

/** Summary, sources and timer one test works with. */
interface InfoPanelStripTestRig {
  readonly summary: InfoPanelStripSummary;
  readonly consoleLog: ConsoleLog;
  readonly scheduler: IssuesScheduler;
  readonly issues: Issue[];
  readonly timer: InfoPanelStripTestTimer;
}

/** Summaries built by the running test. */
const infoPanelStripTestSummaries: InfoPanelStripSummary[] = [];

/**
 * Builds a mounted summary over a fresh log and a scheduler that reports a
 * test-owned issue list.
 *
 * @returns Test rig.
 */
function infoPanelStripTestRigCreate(): InfoPanelStripTestRig {
  const consoleLog = new ConsoleLog();
  const issues: Issue[] = [];
  const timer = new InfoPanelStripTestTimer();
  const scheduler = new IssuesScheduler({
    worldGroup: new THREE.Group(),
    changeSubscribes: [],
    timerSource: new InfoPanelStripTestTimer(),
    issuesCollect: () => [...issues],
  });
  const summary = new InfoPanelStripSummary(document, { consoleLog, issuesScheduler: scheduler, timerSource: timer });
  document.body.appendChild(summary.getElement());
  infoPanelStripTestSummaries.push(summary);
  return { summary, consoleLog, scheduler, issues, timer };
}

/**
 * Returns one count badge of a summary.
 *
 * @param summary Summary holding the badge.
 * @param badgeKind Issues, errors or warnings.
 * @returns Badge element.
 */
function infoPanelStripTestBadgeRead(summary: InfoPanelStripSummary, badgeKind: string): HTMLElement {
  const badge = summary.getElement().querySelector<HTMLElement>(`[data-badge="${badgeKind}"]`);
  if (!badge) {
    throw new Error(`Missing badge ${badgeKind}`);
  }
  return badge;
}

/**
 * Returns the newest line element of a summary.
 *
 * @param summary Summary holding the line.
 * @returns Newest line element.
 */
function infoPanelStripTestNewestLineRead(summary: InfoPanelStripSummary): HTMLElement {
  const line = summary.getElement().querySelector<HTMLElement>(`.${INFO_PANEL_STRIP_NEWEST_LINE_CLASS}`);
  if (!line) {
    throw new Error('Missing newest line');
  }
  return line;
}

/**
 * Returns whether a badge carries its pulse look.
 *
 * @param badge Badge element.
 * @returns True while pulsing.
 */
function infoPanelStripTestIsPulsing(badge: HTMLElement): boolean {
  return badge.className.includes('pulse');
}

afterEach(() => {
  infoPanelStripTestSummaries.splice(0).forEach((summary) => summary.dispose());
  document.body.replaceChildren();
});

describe('InfoPanelStripSummary', () => {
  it('shows the newest console line in its severity color with the full text as tooltip', () => {
    const { summary, consoleLog } = infoPanelStripTestRigCreate();
    consoleLog.entryAppendInfo('first line');
    const newestText = `newest ${'long text '.repeat(20)}`;
    consoleLog.entryAppendError(newestText);
    const line = infoPanelStripTestNewestLineRead(summary);
    expect(line.textContent).toBe(newestText);
    expect(line.title).toBe(newestText);
    expect(line.dataset['level']).toBe('error');
    expect(line.style.color).toBe(uiTestCssColorNormalize(INFO_PANEL_SEVERITY_COLOR_ERROR));
  });

  it('counts console errors and warnings and the issues of the newest validation', () => {
    const { summary, consoleLog, scheduler, issues } = infoPanelStripTestRigCreate();
    consoleLog.entryAppendWarning('warn one');
    consoleLog.entryAppendError('error one');
    consoleLog.entryAppendWarning('warn two');
    issues.push(issueCreate('test', { severity: 'warning', objectUuid: null, objectName: 'a', description: 'one' }));
    scheduler.validationRunNow();
    expect(infoPanelStripTestBadgeRead(summary, 'errors').textContent).toBe('1');
    expect(infoPanelStripTestBadgeRead(summary, 'warnings').textContent).toBe('2');
    expect(infoPanelStripTestBadgeRead(summary, 'issues').textContent).toBe(String(issues.length));
    consoleLog.clear();
    expect(infoPanelStripTestBadgeRead(summary, 'errors').textContent).toBe('0');
    expect(infoPanelStripTestNewestLineRead(summary).textContent).toBe('');
  });

  it('pulses the errors badge for a new error line until the pulse time passes', () => {
    const { summary, consoleLog, timer } = infoPanelStripTestRigCreate();
    const errorsBadge = infoPanelStripTestBadgeRead(summary, 'errors');
    consoleLog.entryAppendWarning('only a warning');
    expect(infoPanelStripTestIsPulsing(errorsBadge)).toBe(false);
    consoleLog.entryAppendError('broken');
    expect(infoPanelStripTestIsPulsing(errorsBadge)).toBe(true);
    timer.advance(INFO_PANEL_STRIP_PULSE_MILLISECONDS - 1);
    expect(infoPanelStripTestIsPulsing(errorsBadge)).toBe(true);
    timer.advance(1);
    expect(infoPanelStripTestIsPulsing(errorsBadge)).toBe(false);
  });

  it('pulses the issues badge only when a validation reports an issue it did not report before', () => {
    const { summary, scheduler, issues, timer } = infoPanelStripTestRigCreate();
    const issuesBadge = infoPanelStripTestBadgeRead(summary, 'issues');
    issues.push(issueCreate('test', { severity: 'error', objectUuid: null, objectName: 'a', description: 'one' }));
    scheduler.validationRunNow();
    expect(infoPanelStripTestIsPulsing(issuesBadge)).toBe(true);
    timer.advance(INFO_PANEL_STRIP_PULSE_MILLISECONDS);
    scheduler.validationRunNow();
    expect(infoPanelStripTestIsPulsing(issuesBadge)).toBe(false);
  });

  it('marks the newest line to reveal the console and the issues badge to reveal the issues', () => {
    const { summary } = infoPanelStripTestRigCreate();
    expect(infoPanelStripTestNewestLineRead(summary).getAttribute('data-info-panel-reveal-tab')).toBe('console');
    expect(infoPanelStripTestBadgeRead(summary, 'issues').getAttribute('data-info-panel-reveal-tab')).toBe('issues');
  });
});

describe('InfoPanelStripSummary in the info panel strip', () => {
  let docks: ShellTestDocks | null = null;
  let mount: ShellDockPanelsMount | null = null;

  afterEach(() => {
    mount?.dispose();
    if (docks) {
      shellTestDocksDispose(docks);
    }
    mount = null;
    docks = null;
  });

  it('shows a new error on the folded strip and pulses its badge without unfolding the panel', () => {
    docks = shellTestDocksCreate();
    const consoleLog = ConsoleLog.shared();
    const testWorld = layerTestWorldCreate();
    const commandStack = new CommandStack(8);
    mount = new ShellDockPanelsMount({
      inspector: docks.inspector,
      infoPanel: docks.infoPanel,
      layerDependencies: {
        layerManager: testWorld.manager,
        commandStack,
        selectionManager: new ManagerSelection(),
        worldGroup: testWorld.world,
        refresh: () => undefined,
      },
      worldGroup: testWorld.world,
      commandStack,
      onIssueActivate: () => undefined,
    });
    const errorText = `strip error ${consoleLog.entriesRead().length}`;
    consoleLog.entryAppendError(errorText);
    const slot = docks.infoPanel.stripSummarySlotRead();
    expect(slot.querySelector(`.${INFO_PANEL_STRIP_NEWEST_LINE_CLASS}`)?.textContent).toBe(errorText);
    expect(infoPanelStripTestIsPulsing(slot.querySelector<HTMLElement>('[data-badge="errors"]') ?? slot)).toBe(true);
    expect(docks.frame.isInfoPanelCollapsed()).toBe(true);
  });
});
