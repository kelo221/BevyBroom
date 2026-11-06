import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Optional size and layout overrides for floating tool-window chrome. */
export interface FloatingPanelToolChromeOptions {
  /** Fixed outer width CSS value (for example `240px`). */
  width?: string;
  /** Fixed outer height CSS value. */
  height?: string;
  /** Minimum outer width CSS value. */
  minWidth?: string;
  /** Minimum outer height CSS value. */
  minHeight?: string;
  /** Maximum outer height CSS value. */
  maxHeight?: string;
  /** Border radius in CSS pixels (default 2). */
  borderRadiusPx?: number;
  /** Box-shadow CSS value (default the theme window shadow). */
  boxShadow?: string;
  /** When true, clips overflowing children. */
  overflowHidden?: boolean;
  /** When true, sets box-sizing to border-box. */
  borderBox?: boolean;
  /** Optional bottom padding CSS value. */
  paddingBottom?: string;
}

/**
 * Applies shared classic Windows tool-window chrome to a floating panel root.
 *
 * @param root Panel root element.
 * @param options Optional size and layout overrides.
 */
export function applyFloatingPanelToolChrome(root: HTMLElement, options: FloatingPanelToolChromeOptions = {}): void {
  root.style.background = hexToRgb(Theme.propertiesPanelBackground);
  root.style.border = `1px solid ${Theme.chromeBorderColor}`;
  root.style.borderRadius = `${options.borderRadiusPx ?? 2}px`;
  root.style.boxShadow = options.boxShadow ?? Theme.windowShadow;
  root.style.color = Theme.buttonTextColor;
  root.style.fontFamily = Theme.uiFontFamily;
  root.style.fontSize = `${Theme.uiFontSizePx}px`;
  applyFloatingPanelToolChromeSizes(root, options);
}

/**
 * Applies optional size-related chrome styles to a floating panel root.
 *
 * @param root Panel root element.
 * @param options Size and overflow options.
 */
function applyFloatingPanelToolChromeSizes(root: HTMLElement, options: FloatingPanelToolChromeOptions): void {
  if (options.width !== undefined) {
    root.style.width = options.width;
  }
  if (options.height !== undefined) {
    root.style.height = options.height;
  }
  if (options.minWidth !== undefined) {
    root.style.minWidth = options.minWidth;
  }
  if (options.minHeight !== undefined) {
    root.style.minHeight = options.minHeight;
  }
  if (options.maxHeight !== undefined) {
    root.style.maxHeight = options.maxHeight;
  }
  if (options.borderBox === true) {
    root.style.boxSizing = 'border-box';
  }
  if (options.overflowHidden === true) {
    root.style.overflow = 'hidden';
  }
  if (options.paddingBottom !== undefined) {
    root.style.paddingBottom = options.paddingBottom;
  }
}
