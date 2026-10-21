import { Theme } from '@/theme.js';
import { InfoPanelView } from '@/info_panel/info_panel_view.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import type { IssuesScheduler } from '@/info_panel/issues/issues_scheduler.js';
import { issuesViewRowCreate } from '@/info_panel/issues/issues_view_row.js';
import {
  issuesViewEmptyStyle,
  issuesViewHeaderCellStyle,
  issuesViewScrollElementStyle,
  issuesViewTableStyle,
} from '@/info_panel/issues/issues_view_styles.js';

/** Text shown when the map has no issues. */
export const ISSUES_VIEW_EMPTY_TEXT = 'No issues';

/** The parts of an issues scheduler the view reads. */
export type IssuesViewSource = Pick<IssuesScheduler, 'issuesRead' | 'changeListenerAdd'>;

/** Runs when the author clicks an issue. */
export type IssuesViewActivateCallback = (issue: Issue) => void;

/**
 * Table of the map's issues with Object and Description columns, refreshed
 * after every validation. Clicking a row marks it and reports its issue.
 */
export class IssuesView extends InfoPanelView {
  private readonly onIssueActivate: IssuesViewActivateCallback;
  private readonly scrollElement: HTMLElement;
  private readonly bodyElement: HTMLTableSectionElement;
  private readonly emptyElement: HTMLElement;
  private readonly issuesById = new Map<string, Issue>();
  private readonly changeListenerRemove: () => void;
  private readonly clickListener: (event: MouseEvent) => void;
  private activeIssueId: string | null = null;

  /**
   * Creates the view showing the source's current issues.
   *
   * @param source Issues source, usually the issues scheduler.
   * @param onIssueActivate Runs with the issue of a clicked row.
   */
  constructor(source: IssuesViewSource, onIssueActivate: IssuesViewActivateCallback) {
    super('editor-issues-view');
    this.onIssueActivate = onIssueActivate;
    this.scrollElement = document.createElement('div');
    this.bodyElement = document.createElement('tbody');
    this.emptyElement = document.createElement('div');
    this.layoutBuild();
    this.clickListener = (event) => this.rowClickHandle(event);
    this.bodyElement.addEventListener('click', this.clickListener);
    this.issuesShow(source.issuesRead());
    this.changeListenerRemove = source.changeListenerAdd((issues) => this.issuesShow(issues));
  }

  /**
   * Replaces the shown issues, keeping the clicked row marked while its issue
   * stays.
   *
   * @param issues Issues to show.
   */
  issuesShow(issues: readonly Issue[]): void {
    this.issuesById.clear();
    issues.forEach((issue) => this.issuesById.set(issue.id, issue));
    this.bodyElement.replaceChildren(...issues.map(issuesViewRowCreate));
    this.emptyElement.style.display = issues.length === 0 ? 'block' : 'none';
    this.scrollElement.style.display = issues.length === 0 ? 'none' : 'block';
    this.activeRowHighlight();
  }

  /** @inheritdoc */
  protected disposeContent(): void {
    this.changeListenerRemove();
    this.bodyElement.removeEventListener('click', this.clickListener);
  }

  /** Builds the empty state text and the table with its header. */
  private layoutBuild(): void {
    this.emptyElement.className = 'editor-issues-empty';
    this.emptyElement.textContent = ISSUES_VIEW_EMPTY_TEXT;
    issuesViewEmptyStyle(this.emptyElement);
    const tableElement = document.createElement('table');
    tableElement.className = 'editor-issues-table';
    issuesViewTableStyle(tableElement);
    tableElement.append(this.headerCreate(), this.bodyElement);
    this.scrollElement.className = 'editor-issues-scroll';
    issuesViewScrollElementStyle(this.scrollElement);
    this.scrollElement.appendChild(tableElement);
    this.rootElement.append(this.emptyElement, this.scrollElement);
  }

  /**
   * Creates the table header with the Object and Description columns.
   *
   * @returns Header section.
   */
  private headerCreate(): HTMLTableSectionElement {
    const headElement = document.createElement('thead');
    const rowElement = document.createElement('tr');
    for (const [label, widthCss] of [
      ['Object', '30%'],
      ['Description', ''],
    ] as const) {
      const headerCell = document.createElement('th');
      headerCell.textContent = label;
      issuesViewHeaderCellStyle(headerCell, widthCss);
      rowElement.appendChild(headerCell);
    }
    headElement.appendChild(rowElement);
    return headElement;
  }

  /**
   * Marks the clicked row and reports its issue.
   *
   * @param event Click inside the table body.
   */
  private rowClickHandle(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const issueId = target?.closest('tr')?.dataset['issueId'];
    const issue = issueId === undefined ? undefined : this.issuesById.get(issueId);
    if (!issue) {
      return;
    }
    this.activeIssueId = issue.id;
    this.activeRowHighlight();
    this.onIssueActivate(issue);
  }

  /** Paints the clicked row in the selection color and the others plain. */
  private activeRowHighlight(): void {
    for (const rowElement of Array.from(this.bodyElement.rows)) {
      const isActive = rowElement.dataset['issueId'] === this.activeIssueId;
      rowElement.style.background = isActive ? Theme.outlinerSelectedColor : 'transparent';
    }
  }
}
