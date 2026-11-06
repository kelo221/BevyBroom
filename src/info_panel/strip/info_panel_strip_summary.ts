import type { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { ConsoleLogChange, ConsoleLogEntry } from '@/info_panel/console/console_log_entry.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import {
  ISSUES_SCHEDULER_TIMER_SOURCE_GLOBAL,
  type IssuesScheduler,
  type IssuesSchedulerTimerSource,
} from '@/info_panel/issues/issues_scheduler.js';
import { infoPanelSeverityColorRead } from '@/info_panel/info_panel_severity.js';
import { InfoPanelStripBadge } from './info_panel_strip_badge.js';
import { infoPanelStripRevealTabWrite } from './info_panel_strip_reveal.js';
import {
  INFO_PANEL_STRIP_NEWEST_LINE_CLASS,
  INFO_PANEL_STRIP_SUMMARY_CLASS,
  infoPanelStripStylesEnsure,
} from './info_panel_strip_styles.js';

/** Sources and timer of the strip summary. */
export interface InfoPanelStripSummaryOptions {
  /** Log whose newest line and error and warning counts are shown. */
  readonly consoleLog: ConsoleLog;
  /** Scheduler whose issue count is shown. */
  readonly issuesScheduler: Pick<IssuesScheduler, 'issuesRead' | 'changeListenerAdd'>;
  /** Timer that ends badge pulses; defaults to the global timers. */
  readonly timerSource?: IssuesSchedulerTimerSource;
}

/**
 * One-line summary of the info panel: the newest console line in its severity
 * color and count badges of issues, console errors and console warnings. A new
 * error line pulses the errors badge and a new issue pulses the issues badge.
 */
export class InfoPanelStripSummary {
  private readonly consoleLog: ConsoleLog;
  private readonly root: HTMLElement;
  private readonly newestLine: HTMLElement;
  private readonly issuesBadge: InfoPanelStripBadge;
  private readonly errorsBadge: InfoPanelStripBadge;
  private readonly warningsBadge: InfoPanelStripBadge;
  private readonly listenerRemovers: Array<() => void>;
  private knownIssueIds: Set<string>;

  /**
   * Creates the summary and shows the current state of its sources.
   *
   * @param ownerDocument Document that creates the elements.
   * @param options Console log, issues scheduler and timer.
   */
  constructor(ownerDocument: Document, options: InfoPanelStripSummaryOptions) {
    infoPanelStripStylesEnsure(ownerDocument);
    this.consoleLog = options.consoleLog;
    const timerSource = options.timerSource ?? ISSUES_SCHEDULER_TIMER_SOURCE_GLOBAL;
    this.root = this.rootCreate(ownerDocument);
    this.newestLine = this.newestLineCreate(ownerDocument);
    this.issuesBadge = this.badgeCreate(ownerDocument, timerSource, 'issues', 'warning');
    this.errorsBadge = this.badgeCreate(ownerDocument, timerSource, 'errors', 'error');
    this.warningsBadge = this.badgeCreate(ownerDocument, timerSource, 'warnings', 'warning');
    this.knownIssueIds = new Set(options.issuesScheduler.issuesRead().map((issue) => issue.id));
    this.issuesBadge.countWrite(this.knownIssueIds.size);
    this.consoleStateShow();
    this.listenerRemovers = [
      this.consoleLog.changeListenerAdd((change) => this.consoleChangeHandle(change)),
      options.issuesScheduler.changeListenerAdd((issues) => this.issuesChangeHandle(issues)),
    ];
  }

  /**
   * Returns the summary root element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Stops listening, ends running pulses and removes the summary. */
  dispose(): void {
    this.listenerRemovers.forEach((listenerRemove) => listenerRemove());
    this.listenerRemovers.length = 0;
    [this.issuesBadge, this.errorsBadge, this.warningsBadge].forEach((badge) => badge.dispose());
    this.root.remove();
  }

  /**
   * Creates the summary row.
   *
   * @param ownerDocument Document that creates the element.
   * @returns Root element.
   */
  private rootCreate(ownerDocument: Document): HTMLElement {
    const root = ownerDocument.createElement('div');
    root.classList.add(INFO_PANEL_STRIP_SUMMARY_CLASS);
    return root;
  }

  /**
   * Creates the newest line element that reveals the console when clicked.
   *
   * @param ownerDocument Document that creates the element.
   * @returns Newest line element appended to the row.
   */
  private newestLineCreate(ownerDocument: Document): HTMLElement {
    const line = ownerDocument.createElement('span');
    line.classList.add(INFO_PANEL_STRIP_NEWEST_LINE_CLASS);
    infoPanelStripRevealTabWrite(line, 'console');
    this.root.appendChild(line);
    return line;
  }

  /**
   * Creates one count badge and appends it to the row.
   *
   * @param ownerDocument Document that creates the element.
   * @param timerSource Timer that ends pulses.
   * @param badgeKind What the badge counts: issues, errors or warnings.
   * @param severity Severity whose color the badge takes.
   * @returns Badge appended to the row.
   */
  private badgeCreate(
    ownerDocument: Document,
    timerSource: IssuesSchedulerTimerSource,
    badgeKind: 'issues' | 'errors' | 'warnings',
    severity: 'warning' | 'error',
  ): InfoPanelStripBadge {
    const badge = new InfoPanelStripBadge(ownerDocument, {
      badgeKind,
      revealTabId: badgeKind === 'issues' ? 'issues' : 'console',
      backgroundColor: infoPanelSeverityColorRead(severity),
      tooltipFormat: (count) => `${count} ${badgeKind}`,
      timerSource,
    });
    this.root.appendChild(badge.getElement());
    return badge;
  }

  /**
   * Updates the newest line and the counts after a console change and pulses
   * the errors badge for a new error line.
   *
   * @param change Console change.
   */
  private consoleChangeHandle(change: ConsoleLogChange): void {
    this.consoleStateShow();
    if (change.kind === 'append' && change.entry.level === 'error') {
      this.errorsBadge.pulse();
    }
  }

  /** Shows the newest console line and the error and warning counts. */
  private consoleStateShow(): void {
    const entries = this.consoleLog.entriesRead();
    this.newestLineWrite(entries[entries.length - 1] ?? null);
    this.errorsBadge.countWrite(entries.filter((entry) => entry.level === 'error').length);
    this.warningsBadge.countWrite(entries.filter((entry) => entry.level === 'warning').length);
  }

  /**
   * Shows one console line, or nothing, as the newest line.
   *
   * @param entry Newest console line, or null for an empty console.
   */
  private newestLineWrite(entry: ConsoleLogEntry | null): void {
    const text = entry?.text ?? '';
    this.newestLine.textContent = text;
    this.newestLine.title = text;
    this.newestLine.dataset['level'] = entry?.level ?? '';
    this.newestLine.style.color = infoPanelSeverityColorRead(entry?.level ?? 'info');
  }

  /**
   * Shows the issue count and pulses the issues badge when an issue appeared
   * that the previous run did not report.
   *
   * @param issues Issues of the newest validation run.
   */
  private issuesChangeHandle(issues: readonly Issue[]): void {
    const issueIds = new Set(issues.map((issue) => issue.id));
    const hasNewIssue = [...issueIds].some((issueId) => !this.knownIssueIds.has(issueId));
    this.knownIssueIds = issueIds;
    this.issuesBadge.countWrite(issueIds.size);
    if (hasNewIssue) {
      this.issuesBadge.pulse();
    }
  }
}
