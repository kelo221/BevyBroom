import { Theme } from '@/theme.js';

/** Compact metrics shared by the face inspector controls. */
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
 * Creates a square, dark-backed material preview thumbnail whose image is set
 * with {@link faceInspectorPreviewImageWrite}.
 *
 * @param sizePx Edge length in pixels.
 * @param className Class name of the thumbnail.
 * @param ariaLabel Accessible name of the image.
 * @returns Thumbnail element.
 */
export function faceInspectorPreviewThumbnailCreate(sizePx: number, className: string, ariaLabel: string): HTMLElement {
  const size = `${sizePx}px`;
  const thumbnail = document.createElement('div');
  thumbnail.classList.add(className);
  thumbnail.setAttribute('role', 'img');
  thumbnail.setAttribute('aria-label', ariaLabel);
  thumbnail.style.width = size;
  thumbnail.style.height = size;
  thumbnail.style.flex = `0 0 ${size}`;
  thumbnail.style.border = `1px solid ${Theme.inputBorderColor}`;
  thumbnail.style.borderRadius = '2px';
  thumbnail.style.backgroundColor = Theme.textureThumbnailBackground;
  thumbnail.style.backgroundSize = 'cover';
  thumbnail.style.backgroundPosition = 'center';
  return thumbnail;
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
