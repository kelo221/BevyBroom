import { Theme } from '@/theme.js';

/**
 * Applies the theme backdrop filter to an element so a translucent face blurs
 * whatever is behind it; the classic look sets no filter.
 *
 * @param element Element whose backdrop is filtered.
 */
export function themeGlassBackdropApply(element: HTMLElement): void {
  element.style.backdropFilter = Theme.glassBackdropFilter;
  element.style.setProperty('-webkit-backdrop-filter', Theme.glassBackdropFilter);
}
