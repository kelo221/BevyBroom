import { Theme } from '@/theme.js';

/** Importance of a console line or an issue. */
export type InfoPanelSeverity = 'info' | 'warning' | 'error';

/** Text color of error lines and error issues. */
export const INFO_PANEL_SEVERITY_COLOR_ERROR = Theme.severityErrorColor;

/** Text color of warning lines and warning issues. */
export const INFO_PANEL_SEVERITY_COLOR_WARNING = Theme.severityWarningColor;

/** Text color of informational lines. */
export const INFO_PANEL_SEVERITY_COLOR_INFO = Theme.severityInfoColor;

/**
 * Returns the text color of a severity.
 *
 * @param severity Importance of the line or issue.
 * @returns CSS color.
 */
export function infoPanelSeverityColorRead(severity: InfoPanelSeverity): string {
  if (severity === 'error') {
    return INFO_PANEL_SEVERITY_COLOR_ERROR;
  }
  if (severity === 'warning') {
    return INFO_PANEL_SEVERITY_COLOR_WARNING;
  }
  return INFO_PANEL_SEVERITY_COLOR_INFO;
}
