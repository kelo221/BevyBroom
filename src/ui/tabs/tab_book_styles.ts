import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Visual style of a tab strip: an underlined tab row or rounded pill buttons. */
export type TabBookVariant = 'underline' | 'pill';

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
  styleElement.textContent = [tabBookBaseCss(), tabBookUnderlineCss(), tabBookPillCss()].join('\n');
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
.${TAB_BOOK_TAB_CLASS} { cursor: pointer; font-family: ${Theme.uiFontFamily}; font-size: 12px; font-weight: 500; color: ${Theme.buttonTextColor}; background: transparent; border: 1px solid transparent; letter-spacing: 0.01em; }
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
  const selection = hexToRgb(Theme.selectionColor);
  return `
${root} > .${TAB_BOOK_STRIP_CLASS} { gap: 2px; padding: 0 8px; background: ${hexToRgb(Theme.toolbarBackground)}; border-bottom: 1px solid ${hexToRgb(Theme.separatorColor)}; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS} { padding: 6px 10px 5px; border-width: 0 0 2px 0; border-radius: 0; font-weight: 600; color: #b0b0b0; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}:hover { color: #ffffff; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}[aria-selected="true"] { color: #ffffff; border-bottom-color: ${selection}; }
`.trim();
}

/**
 * Builds the rules of the pill variant used by dialogs.
 *
 * @returns CSS text.
 */
function tabBookPillCss(): string {
  const root = `.${tabBookVariantClass('pill')}`;
  const selection = hexToRgb(Theme.selectionColor);
  return `
${root} > .${TAB_BOOK_STRIP_CLASS} { gap: 4px; padding: 8px 12px; background: ${hexToRgb(Theme.toolbarBackground)}; border-bottom: 1px solid ${hexToRgb(Theme.separatorColor)}; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS} { padding: 5px 10px; border-radius: 4px; transition: background 80ms ease, border-color 80ms ease; }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}:hover { background: ${hexToRgb(Theme.buttonHoverColor)}; border-color: rgba(255,255,255,0.06); }
${root} > .${TAB_BOOK_STRIP_CLASS} > .${TAB_BOOK_TAB_CLASS}[aria-selected="true"] { color: #ffffff; background: rgba(232, 106, 23, 0.22); border-color: ${selection}; }
`.trim();
}
