import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Compact TrenchBroom-like metrics shared by the face inspector controls. */
export const FACE_INSPECTOR_METRICS = Object.freeze({
  paddingX: 8,
  paddingY: 6,
  gap: 4,
  controlHeight: 22,
  nudgeWidth: 26,
  iconButtonSize: 24,
  captionFontSize: '11px',
  smallFontSize: '10px',
});

/** Content and size of one face inspector button. */
export interface FaceInspectorButtonOptions {
  /** Accessible name and tooltip. */
  title: string;
  /** Visible text label, when the button shows text. */
  text?: string;
  /** SVG markup, when the button shows an icon. */
  svgIcon?: string;
  /** Fixed width in pixels, or null to size to the content. */
  widthPx: number | null;
  /** Height in pixels. */
  heightPx: number;
  /** Click handler. */
  onClick: () => void;
}

/**
 * Creates a themed compact button with hover feedback.
 *
 * @param options Button content, size and click handler.
 * @returns Button element.
 */
export function faceInspectorButtonCreate(options: FaceInspectorButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = options.title;
  button.setAttribute('aria-label', options.title);
  faceInspectorButtonContentWrite(button, options);
  faceInspectorButtonChromeApply(button, options.widthPx, options.heightPx);
  faceInspectorButtonHoverBind(button);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onClick();
  });
  return button;
}

/**
 * Creates a dim caption label in the inspector font.
 *
 * @param text Caption text.
 * @returns Caption element.
 */
export function faceInspectorCaptionCreate(text: string): HTMLElement {
  const caption = document.createElement('span');
  caption.textContent = text;
  caption.style.color = Theme.statusBarTextColor;
  caption.style.fontFamily = Theme.uiFontFamily;
  caption.style.fontSize = FACE_INSPECTOR_METRICS.captionFontSize;
  caption.style.whiteSpace = 'nowrap';
  caption.style.overflow = 'hidden';
  caption.style.textOverflow = 'ellipsis';
  return caption;
}

/**
 * Shows a material preview image as the element's background, or clears it.
 *
 * @param element Preview element.
 * @param previewUrl Image URL, or null for no preview.
 */
export function faceInspectorPreviewImageWrite(element: HTMLElement, previewUrl: string | null): void {
  if (previewUrl === null) {
    element.style.backgroundImage = 'none';
    return;
  }
  const quotedUrl = previewUrl.replace(/"/g, '\\"');
  element.style.backgroundImage = `url("${quotedUrl}")`;
}

/**
 * Writes the text or icon content of a button.
 *
 * @param button Button element.
 * @param options Button content options.
 */
function faceInspectorButtonContentWrite(button: HTMLButtonElement, options: FaceInspectorButtonOptions): void {
  if (options.svgIcon !== undefined) {
    button.innerHTML = options.svgIcon;
    return;
  }
  button.textContent = options.text ?? options.title;
}

/**
 * Applies the size, border and colors of a compact inspector button.
 *
 * @param button Button element.
 * @param widthPx Fixed width in pixels, or null to size to the content.
 * @param heightPx Height in pixels.
 */
function faceInspectorButtonChromeApply(button: HTMLButtonElement, widthPx: number | null, heightPx: number): void {
  faceInspectorButtonSizeApply(button, widthPx, heightPx);
  faceInspectorButtonColorsApply(button);
}

/**
 * Applies the box size and content alignment of a compact inspector button.
 *
 * @param button Button element.
 * @param widthPx Fixed width in pixels, or null to size to the content.
 * @param heightPx Height in pixels.
 */
function faceInspectorButtonSizeApply(button: HTMLButtonElement, widthPx: number | null, heightPx: number): void {
  if (widthPx !== null) {
    button.style.width = `${widthPx}px`;
    button.style.flex = `0 0 ${widthPx}px`;
  }
  button.style.height = `${heightPx}px`;
  button.style.boxSizing = 'border-box';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.padding = widthPx === null ? '0 8px' : '0';
}

/**
 * Applies the border, colors and font of a compact inspector button.
 *
 * @param button Button element.
 */
function faceInspectorButtonColorsApply(button: HTMLButtonElement): void {
  button.style.border = `1px solid ${Theme.inputBorderColor}`;
  button.style.borderRadius = '2px';
  button.style.background = hexToRgb(Theme.buttonBackground);
  button.style.color = Theme.buttonTextColor;
  button.style.fontFamily = Theme.uiFontFamily;
  button.style.fontSize = FACE_INSPECTOR_METRICS.smallFontSize;
  button.style.cursor = 'pointer';
  button.style.overflow = 'hidden';
}

/**
 * Lightens a button's background while the pointer is over it.
 *
 * @param button Button element.
 */
function faceInspectorButtonHoverBind(button: HTMLButtonElement): void {
  button.addEventListener('mouseenter', () => {
    button.style.background = hexToRgb(Theme.buttonHoverColor);
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = hexToRgb(Theme.buttonBackground);
  });
}
