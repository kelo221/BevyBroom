import { Theme } from '@/theme.js';
import {
  TAB_BOOK_CONTENT_CLASS,
  TAB_BOOK_ROOT_CLASS,
  TAB_BOOK_STRIP_CLASS,
  TAB_BOOK_TAB_CLASS,
} from '@/ui/tabs/tab_book_styles.js';

/** CSS class of the info panel root. */
export const SHELL_INFO_PANEL_CLASS = 'shell-info-panel';

/** CSS class the info panel root carries while folded to its strip. */
export const SHELL_INFO_PANEL_COLLAPSED_CLASS = 'shell-info-panel-collapsed';

/** CSS class of the strip part that holds the newest line and the badges. */
export const SHELL_INFO_PANEL_STRIP_SUMMARY_CLASS = 'shell-info-panel-strip-summary';

/** Id of the style element that holds the info panel CSS. */
const SHELL_INFO_PANEL_STYLE_ELEMENT_ID = 'bevybroom-shell-info-panel-styles';

/**
 * Injects the info panel CSS into the document once.
 *
 * @param ownerDocument Document that hosts the info panel.
 */
export function shellInfoPanelStylesEnsure(ownerDocument: Document): void {
  if (ownerDocument.getElementById(SHELL_INFO_PANEL_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = ownerDocument.createElement('style');
  styleElement.id = SHELL_INFO_PANEL_STYLE_ELEMENT_ID;
  styleElement.textContent = shellInfoPanelCssBuild();
  ownerDocument.head.appendChild(styleElement);
}

/**
 * Builds the rules of the one-line strip, its tabs and the folded state.
 *
 * @returns CSS text.
 */
function shellInfoPanelCssBuild(): string {
  const root = `.${TAB_BOOK_ROOT_CLASS}.${SHELL_INFO_PANEL_CLASS}`;
  const strip = `${root} > .${TAB_BOOK_STRIP_CLASS}`;
  return `
${strip} { height: ${Theme.infoStripHeightPx}px; box-sizing: border-box; flex-wrap: nowrap; overflow: hidden; gap: 0; padding: 0 2px; }
${strip} > .${TAB_BOOK_TAB_CLASS} { box-sizing: border-box; height: 100%; padding: 0 8px; flex: 0 0 auto; font-size: ${Theme.uiFontSizePx}px; line-height: 1; white-space: nowrap; }
${strip} > .${SHELL_INFO_PANEL_STRIP_SUMMARY_CLASS} { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; height: 100%; }
${root}.${SHELL_INFO_PANEL_COLLAPSED_CLASS} > .${TAB_BOOK_CONTENT_CLASS} { display: none; }
`.trim();
}
