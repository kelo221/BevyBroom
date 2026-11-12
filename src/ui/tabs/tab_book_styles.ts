import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/**
 * Visual style of a tab strip: an underlined tab row, rounded pill buttons, or
 * a compact one-line row of small underlined tabs for dialogs.
 */
export type TabBookVariant = 'underline' | 'pill' | 'compact';

/** Id of the style element that holds the shared tab book CSS. */
const TAB_BOOK_STYLE_ELEMENT_ID = 'bevybroom-tab-book-styles';

/** CSS class of the tab book root. */
export const TAB_BOOK_ROOT_CLASS = 'tab-book';

/** CSS class of the tab strip row. */
export const TAB_BOOK_STRIP_CLASS = 'tab-book-strip';

/** CSS class of one tab button. */
export const TAB_BOOK_TAB_CLASS = 'tab-book-tab';

/** CSS class of the page host below the strip. */
export const TAB_BOOK_CONTENT_CLASS = 'tab-book-content';

/** CSS class of one page wrapper inside the page host. */
export const TAB_BOOK_PAGE_CLASS = 'tab-book-page';

/**
 * Returns the CSS class that selects one visual variant.
 *
 * @param variant Tab strip variant.
 * @returns Variant class name placed on the tab book root.
 */
export function tabBookVariantClass(variant: TabBookVariant): string {
  return `tab-book-variant-${variant}`;
}

/**
 * Injects the shared tab book CSS into the document once.
 *
 * @param ownerDocument Document that hosts the tab book.
 */
export function tabBookStylesEnsure(ownerDocument: Document): void {
  if (ownerDocument.getElementById(TAB_BOOK_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = ownerDocument.createElement('style');
  styleElement.id = TAB_BOOK_STYLE_ELEMENT_ID;
  styleElement.textContent = [tabBookBaseCss(), tabBookUnderlineCss(), tabBookPillCss(), tabBookCompactCss()].join(
    '\n',
  );
  ownerDocument.head.appendChild(styleElement);
}

/**
 * Builds the layout rules shared by every variant.
 *
 * @returns CSS text.
 */
function tabBookBaseCss(): string {
  return `
.${TAB_BOOK_ROOT_CLASS} { display: flex; flex-direction: column; min-width: 0; min-height: 0; font-family: ${Theme.uiFontFamily}; color: ${Theme.buttonTextColor}; }
.${TAB_BOOK_STRIP_CLASS} { display: flex; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
.${TAB_BOOK_TAB_CLASS} { cursor: pointer; font-family: ${Theme.uiFontFamily}; font-size: ${Theme.uiFontSizePx}px; font-weight: 400; color: ${Theme.buttonTextColor}; background: transparent; border: 1px solid transparent; letter-spacing: 0.01em; }
.${TAB_BOOK_CONTENT_CLASS} { position: relative; display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; min-height: 0; }
.${TAB_BOOK_PAGE_CLASS} { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; min-height: 0; }
.${TAB_BOOK_PAGE_CLASS}[hidden] { display: none; }
`.trim();
}

/**
 * Builds the rules of the underlined variant used by docked panels.
 *
 * @returns CSS text.
 */
function tabBookUnderlineCss(): string {
  const root = `.${tabBookVariantClass('underline')}`;
  return `
${root} > .${TAB_BOOK_STRIP_CLASS} { gap: 2px; padding: 0 8px; background: ${hexToRgb(Theme.toolbarBackground)}; border-bottom: 1px solid ${Theme.chromeBorderColor}; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS} { padding: 4px 10px 3px; border-width: 0 0 2px 0; border-radius: 0; color: ${Theme.secondaryTextColor}; }
${tabBookActiveTabCss(root)}
`.trim();
}

/**
 * Builds the rules of the compact variant: small underlined tabs that stay on
 * one line.
 *
 * @returns CSS text.
 */
function tabBookCompactCss(): string {
  const root = `.${tabBookVariantClass('compact')}`;
  return `
${root} > .${TAB_BOOK_STRIP_CLASS} { flex-wrap: nowrap; gap: 0; padding: 0 6px; overflow: hidden; background: ${hexToRgb(Theme.toolbarBackground)}; border-bottom: 1px solid ${Theme.chromeBorderColor}; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS} { padding: 3px 8px 2px; white-space: nowrap; flex-shrink: 0; border-width: 0 0 2px 0; border-radius: 0; color: ${Theme.secondaryTextColor}; }
${tabBookActiveTabCss(root)}
`.trim();
}

/**
 * Builds the rules of the pill variant used by dialogs.
 *
 * @returns CSS text.
 */
function tabBookPillCss(): string {
  const root = `.${tabBookVariantClass('pill')}`;
  return `
${root} > .${TAB_BOOK_STRIP_CLASS} { gap: 4px; padding: 6px 10px; background: ${hexToRgb(Theme.toolbarBackground)}; border-bottom: 1px solid ${Theme.chromeBorderColor}; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS} { padding: 3px 10px; border-radius: ${Theme.controlRadiusPx}px; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}:hover { background: ${hexToRgb(Theme.buttonHoverColor)}; border-color: ${Theme.chromeBorderColor}; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}[aria-selected="true"] { color: ${Theme.buttonTextColor}; background: ${Theme.buttonPressedBackground}; border-color: ${Theme.toggleActiveBorder}; }
`.trim();
}

/**
 * Builds the hover and selected rules of an underlined tab strip: hovered tabs
 * get the hover overlay, the selected tab the active background and an accent
 * underline.
 *
 * @param root Selector of the variant root.
 * @returns CSS text.
 */
function tabBookActiveTabCss(root: string): string {
  const tab = `${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}`;
  return `
${tab}:hover { color: ${Theme.buttonTextColor}; background: ${Theme.hoverOverlay}; }
${tab}[aria-selected="true"] { color: ${Theme.buttonTextColor}; background: ${Theme.tabActiveBackground}; border-bottom-color: ${Theme.tabActiveAccent}; }
`.trim();
}
