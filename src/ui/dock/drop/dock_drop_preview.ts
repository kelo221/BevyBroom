import { Theme } from '@/theme.js';
import type { PanelFloatingLayoutRect } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';

/** Data attribute on the dock drop preview element. */
export const DOCK_DROP_PREVIEW_ATTRIBUTE = 'data-dock-drop-preview';

/**
 * Translucent blue rectangle showing where a dragged window docks when
 * released. It ignores the pointer so the drag keeps working underneath.
 */
export class DockDropPreview {
  private readonly element: HTMLElement;
  private readonly ownerDocument: Document;

  /**
   * Creates the hidden preview.
   *
   * @param ownerDocument Document that shows the preview.
   */
  constructor(ownerDocument: Document) {
    this.ownerDocument = ownerDocument;
    this.element = ownerDocument.createElement('div');
    this.element.setAttribute(DOCK_DROP_PREVIEW_ATTRIBUTE, '');
    this.stylesApply();
  }

  /**
   * Shows the preview over a rect.
   *
   * @param rect Area the docked window would take, in client pixels.
   */
  show(rect: PanelFloatingLayoutRect): void {
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top}px`;
    this.element.style.width = `${rect.width}px`;
    this.element.style.height = `${rect.height}px`;
    if (!this.element.isConnected) {
      this.ownerDocument.body.appendChild(this.element);
    }
  }

  /** Hides the preview. */
  hide(): void {
    this.element.remove();
  }

  /**
   * Returns whether the preview is shown.
   *
   * @returns True while shown.
   */
  isShown(): boolean {
    return this.element.isConnected;
  }

  /** Applies the fixed, click-through look of the preview. */
  private stylesApply(): void {
    const style = this.element.style;
    style.position = 'fixed';
    style.pointerEvents = 'none';
    style.boxSizing = 'border-box';
    style.background = Theme.dockDropPreviewFill;
    style.border = `2px solid ${Theme.dockDropPreviewBorder}`;
    style.zIndex = String(UiStackLayers.dragGhost);
  }
}
