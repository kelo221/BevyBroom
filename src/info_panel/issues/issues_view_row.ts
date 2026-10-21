import type { Issue, IssueSeverity } from '@/info_panel/issues/issue.js';
import { infoPanelSeverityColorRead } from '@/info_panel/info_panel_severity.js';
import {
  issuesViewBodyCellStyle,
  issuesViewRowStyle,
  issuesViewSeverityMarkStyle,
} from '@/info_panel/issues/issues_view_styles.js';

/** Glyph marking the severity of an issue. */
const ISSUES_VIEW_SEVERITY_GLYPHS: Readonly<Record<IssueSeverity, string>> = {
  warning: '\u25B2',
  error: '\u2716',
};

/**
 * Creates the table row of one issue: severity mark and object name, then the
 * description.
 *
 * @param issue Issue shown.
 * @returns Row element carrying the issue id and severity in its data
 *   attributes.
 */
export function issuesViewRowCreate(issue: Issue): HTMLTableRowElement {
  const rowElement = document.createElement('tr');
  rowElement.className = 'editor-issues-row';
  rowElement.dataset['issueId'] = issue.id;
  rowElement.dataset['severity'] = issue.severity;
  rowElement.title = issue.description;
  issuesViewRowStyle(rowElement);
  rowElement.append(issuesViewObjectCellCreate(issue), issuesViewDescriptionCellCreate(issue));
  return rowElement;
}

/**
 * Creates the object cell: severity mark followed by the object name.
 *
 * @param issue Issue shown.
 * @returns Cell element.
 */
function issuesViewObjectCellCreate(issue: Issue): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'editor-issues-object';
  issuesViewBodyCellStyle(cell);
  const markElement = document.createElement('span');
  markElement.className = 'editor-issues-severity';
  markElement.textContent = ISSUES_VIEW_SEVERITY_GLYPHS[issue.severity];
  issuesViewSeverityMarkStyle(markElement, infoPanelSeverityColorRead(issue.severity));
  const nameElement = document.createElement('span');
  nameElement.textContent = issue.objectName === '' ? '(unnamed)' : issue.objectName;
  cell.append(markElement, nameElement);
  return cell;
}

/**
 * Creates the description cell.
 *
 * @param issue Issue shown.
 * @returns Cell element.
 */
function issuesViewDescriptionCellCreate(issue: Issue): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'editor-issues-description';
  issuesViewBodyCellStyle(cell);
  cell.textContent = issue.description;
  return cell;
}
