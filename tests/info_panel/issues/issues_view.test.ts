import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueCreate, type Issue } from '@/info_panel/issues/issue.js';
import { ISSUES_VIEW_EMPTY_TEXT, IssuesView, type IssuesViewSource } from '@/info_panel/issues/issues_view.js';
import type { IssuesSchedulerListener } from '@/info_panel/issues/issues_scheduler.js';

/** A hand-driven issues source. */
interface FakeIssuesSource extends IssuesViewSource {
  publish: (issues: readonly Issue[]) => void;
}

/**
 * Creates an issues source whose issues the test publishes.
 *
 * @param initial Issues shown first.
 * @returns The source.
 */
function sourceCreate(initial: readonly Issue[]): FakeIssuesSource {
  let current = initial;
  const listeners = new Set<IssuesSchedulerListener>();
  return {
    issuesRead: () => current,
    changeListenerAdd: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (issues) => {
      current = issues;
      listeners.forEach((listener) => listener(issues));
    },
  };
}

/**
 * Creates test issues with runtime names.
 *
 * @returns One warning and one error.
 */
function issuesCreate(): Issue[] {
  const suffix = Math.floor(Math.random() * 1000);
  return [
    issueCreate('test', {
      severity: 'warning',
      objectUuid: `a${suffix}`,
      objectName: `A${suffix}`,
      description: 'Warn',
    }),
    issueCreate('test', { severity: 'error', objectUuid: `b${suffix}`, objectName: `B${suffix}`, description: 'Fail' }),
  ];
}

/**
 * Returns the issue rows a view shows.
 *
 * @param view Issues view.
 * @returns Row elements.
 */
function rowsRead(view: IssuesView): HTMLTableRowElement[] {
  return Array.from(view.getElement().querySelectorAll<HTMLTableRowElement>('tr.editor-issues-row'));
}

/**
 * Unit tests for the issues view: Object and Description columns with severity
 * marks, the empty state, refreshes and row activation.
 */
describe('IssuesView', () => {
  const views: IssuesView[] = [];

  afterEach(() => {
    views.splice(0).forEach((view) => view.dispose());
  });

  it('shows one row per issue with object, severity and description', () => {
    const issues = issuesCreate();
    const view = new IssuesView(sourceCreate(issues), () => undefined);
    views.push(view);
    const headers = Array.from(view.getElement().querySelectorAll('th')).map((cell) => cell.textContent);
    expect(headers).toEqual(['Object', 'Description']);
    const rows = rowsRead(view);
    expect(rows.map((row) => row.dataset['severity'])).toEqual(['warning', 'error']);
    expect(rows[1]?.querySelector('.editor-issues-object')?.textContent).toContain(issues[1]?.objectName ?? 'x');
    expect(rows[1]?.querySelector('.editor-issues-description')?.textContent).toBe('Fail');
  });

  it('shows the empty text when there are no issues and switches with new results', () => {
    const source = sourceCreate([]);
    const view = new IssuesView(source, () => undefined);
    views.push(view);
    const emptyElement = view.getElement().querySelector<HTMLElement>('.editor-issues-empty');
    expect(emptyElement?.textContent).toBe(ISSUES_VIEW_EMPTY_TEXT);
    expect(emptyElement?.style.display).toBe('block');
    source.publish(issuesCreate());
    expect(emptyElement?.style.display).toBe('none');
    expect(rowsRead(view).length).toBe(2);
  });

  it('reports the issue of a clicked row and keeps the row marked across refreshes', () => {
    const issues = issuesCreate();
    const source = sourceCreate(issues);
    const onIssueActivate = vi.fn();
    const view = new IssuesView(source, onIssueActivate);
    views.push(view);
    rowsRead(view)[1]
      ?.querySelector('td')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onIssueActivate).toHaveBeenCalledWith(issues[1]);
    source.publish([...issues]);
    const marked = rowsRead(view).filter((row) => row.style.background !== 'transparent');
    expect(marked.map((row) => row.dataset['issueId'])).toEqual([issues[1]?.id]);
  });

  it('stops following its source once disposed', () => {
    const source = sourceCreate([]);
    const view = new IssuesView(source, () => undefined);
    view.dispose();
    source.publish(issuesCreate());
    expect(rowsRead(view)).toEqual([]);
  });
});
