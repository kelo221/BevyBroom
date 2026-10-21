/** Importance of a console line or an issue. */
export type InfoPanelSeverity = 'info' | 'warning' | 'error';

/** Text color of error lines and error issues. */
export const INFO_PANEL_SEVERITY_COLOR_ERROR = 'rgb(250, 30, 60)';

/** Text color of warning lines and warning issues. */
export const INFO_PANEL_SEVERITY_COLOR_WARNING = 'rgb(240, 180, 40)';

/** Text color of informational lines. */
export const INFO_PANEL_SEVERITY_COLOR_INFO = '#c8c8c8';

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
