import { Theme } from '@/theme.js';

/** CSS class of the strip summary root. */
export const INFO_PANEL_STRIP_SUMMARY_CLASS = 'info-panel-strip-summary';

/** CSS class of the newest console line shown on the strip. */
export const INFO_PANEL_STRIP_NEWEST_LINE_CLASS = 'info-panel-strip-newest-line';

/** CSS class of one count badge. */
export const INFO_PANEL_STRIP_BADGE_CLASS = 'info-panel-strip-badge';

/** CSS class a count badge carries while its count is zero. */
export const INFO_PANEL_STRIP_BADGE_EMPTY_CLASS = 'info-panel-strip-badge-empty';

/** CSS class a count badge carries while it pulses. */
export const INFO_PANEL_STRIP_BADGE_PULSE_CLASS = 'info-panel-strip-badge-pulse';

/** How long one badge pulse lasts in milliseconds. */
export const INFO_PANEL_STRIP_PULSE_MILLISECONDS = 1200;

/** Id of the style element that holds the strip summary CSS. */
const INFO_PANEL_STRIP_STYLE_ELEMENT_ID = 'bevybroom-info-panel-strip-styles';

/**
 * Injects the strip summary CSS into the document once.
 *
 * @param ownerDocument Document that hosts the strip.
 */
export function infoPanelStripStylesEnsure(ownerDocument: Document): void {
  if (ownerDocument.getElementById(INFO_PANEL_STRIP_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = ownerDocument.createElement('style');
  styleElement.id = INFO_PANEL_STRIP_STYLE_ELEMENT_ID;
  styleElement.textContent = [infoPanelStripLayoutCssBuild(), infoPanelStripBadgeCssBuild()].join('\n');
  ownerDocument.head.appendChild(styleElement);
}

/**
 * Builds the rules of the summary row and its ellipsized newest line.
 *
 * @returns CSS text.
 */
function infoPanelStripLayoutCssBuild(): string {
  return `
.${INFO_PANEL_STRIP_SUMMARY_CLASS} { display: flex; align-items: center; gap: 4px; flex: 1 1 auto; min-width: 0; height: 100%; padding: 0 4px; box-sizing: border-box; font-family: ${Theme.uiFontFamily}; font-size: ${Theme.uiFontSizePx}px; }
.${INFO_PANEL_STRIP_NEWEST_LINE_CLASS} { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
`.trim();
}

/**
 * Builds the rules of the count badges and their pulse.
 *
 * @returns CSS text.
 */
function infoPanelStripBadgeCssBuild(): string {
  const pulseSeconds = INFO_PANEL_STRIP_PULSE_MILLISECONDS / 3000;
  return `
.${INFO_PANEL_STRIP_BADGE_CLASS} { flex: 0 0 auto; min-width: 14px; height: 14px; padding: 0 4px; box-sizing: border-box; border-radius: 7px; color: ${Theme.inverseTextColor}; font-size: 10px; line-height: 14px; text-align: center; cursor: pointer; }
.${INFO_PANEL_STRIP_BADGE_EMPTY_CLASS} { opacity: 0.4; }
@keyframes ${INFO_PANEL_STRIP_BADGE_PULSE_CLASS} { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; } 50% { transform: scale(1.25); box-shadow: 0 0 0 3px ${Theme.badgePulseGlowColor}; } }
.${INFO_PANEL_STRIP_BADGE_PULSE_CLASS} { animation: ${INFO_PANEL_STRIP_BADGE_PULSE_CLASS} ${pulseSeconds}s ease-in-out 3; }
`.trim();
}
