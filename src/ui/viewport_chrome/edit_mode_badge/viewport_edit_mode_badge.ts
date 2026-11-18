import { Theme } from '@/theme.js';
import { ViewportEditModeBadgeState } from './viewport_edit_mode_badge_state.js';

/** CSS class of the Edit Mode badge in a viewport corner. */
export const VIEWPORT_EDIT_MODE_BADGE_CLASS = 'editor-viewport-edit-mode-badge';

/**
 * Blue corner badge ("EDIT · VERTEX") shown next to the viewport label while
 * Edit Mode is on, so the active component kind is always visible in the view.
 */
export class ViewportEditModeBadge {
  private readonly badgeElement: HTMLElement;
  private readonly unregister: () => void;

  /**
   * Creates the badge inside the parent element.
   *
   * @param parentElement Element that receives the badge.
   */
  constructor(parentElement: HTMLElement) {
    this.badgeElement = parentElement.ownerDocument.createElement('div');
    this.badgeElement.classList.add(VIEWPORT_EDIT_MODE_BADGE_CLASS);
    this.stylesApply();
    parentElement.appendChild(this.badgeElement);
    this.unregister = ViewportEditModeBadgeState.listenerAdd((text) => this.textShow(text));
  }

  /**
   * Returns the badge element.
   *
   * @returns Badge element.
   */
  getElement(): HTMLElement {
    return this.badgeElement;
  }

  /** Stops listening and removes the badge. */
  dispose(): void {
    this.unregister();
    this.badgeElement.remove();
  }

  /**
   * Shows a text, or hides the badge when there is none.
   *
   * @param text Badge text, or null outside Edit Mode.
   */
  private textShow(text: string | null): void {
    this.badgeElement.textContent = text ?? '';
    this.badgeElement.style.display = text === null ? 'none' : 'block';
  }

  /** Applies the compact blue badge look. */
  private stylesApply(): void {
    const style = this.badgeElement.style;
    style.height = `${Theme.viewportLabelHeightPx}px`;
    style.lineHeight = `${Theme.viewportLabelHeightPx}px`;
    style.padding = '0 6px';
    style.borderRadius = `${Theme.viewportLabelRadiusPx}px`;
    style.fontFamily = Theme.uiFontFamily;
    style.fontSize = `${Theme.uiFontSizePx}px`;
    style.fontWeight = '600';
    style.color = Theme.viewportEditBadgeTextColor;
    style.background = Theme.viewportEditBadgeBackgroundColor;
    style.whiteSpace = 'nowrap';
    style.userSelect = 'none';
    style.pointerEvents = 'none';
  }
}
