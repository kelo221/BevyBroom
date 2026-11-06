import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';

/** CSS class of the hover-only icon row at the top-right of a viewport. */
export const VIEWPORT_HOVER_BUTTON_ROW_CLASS = 'editor-viewport-hover-row';

/** Size of a hover row icon button in CSS pixels. */
const VIEWPORT_HOVER_BUTTON_PX = 20;

/** Size of an icon inside a hover row button in CSS pixels. */
const VIEWPORT_HOVER_ICON_PX = 16;

/**
 * Compact row of icon buttons at the top-right of a viewport, shown only while
 * the pointer is over that viewport.
 */
export class ViewportHoverButtonRow {
  private readonly hoverHost: HTMLElement;
  private readonly root: HTMLElement;
  private readonly onPointerEnter: () => void;
  private readonly onPointerLeave: () => void;

  /**
   * Creates the hidden row and shows it while the pointer is over the host.
   *
   * @param hoverHost Viewport pane element that receives the row and whose
   *   hover shows it.
   */
  constructor(hoverHost: HTMLElement) {
    this.hoverHost = hoverHost;
    this.root = hoverHost.ownerDocument.createElement('div');
    this.rootStyle();
    this.onPointerEnter = () => this.visibleSet(true);
    this.onPointerLeave = () => this.visibleSet(false);
    hoverHost.addEventListener('pointerenter', this.onPointerEnter);
    hoverHost.addEventListener('pointerleave', this.onPointerLeave);
    hoverHost.appendChild(this.root);
    this.visibleSet(false);
  }

  /**
   * Appends one icon button to the row.
   *
   * @param tooltip Tooltip and accessible name.
   * @param iconSvg Icon markup.
   * @param onClick Invoked when the button is clicked.
   * @returns The created button.
   */
  buttonAdd(tooltip: string, iconSvg: string, onClick: () => void): HTMLButtonElement {
    const button = this.root.ownerDocument.createElement('button');
    button.type = 'button';
    button.title = tooltip;
    button.setAttribute('aria-label', tooltip);
    button.innerHTML = iconSvg;
    this.buttonStyle(button);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    this.root.appendChild(button);
    this.buttonActiveSet(button, false);
    return button;
  }

  /**
   * Shows a button as toggled on or off.
   *
   * @param button Row button.
   * @param active True when toggled on.
   */
  buttonActiveSet(button: HTMLButtonElement, active: boolean): void {
    button.dataset['active'] = active ? 'true' : 'false';
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.style.background = active ? Theme.buttonPressedBackground : hexToRgb(Theme.buttonBackground);
    button.style.borderColor = active ? Theme.toggleActiveBorder : Theme.chromeBorderColor;
  }

  /**
   * Shows or hides the row.
   *
   * @param visible True to show it.
   */
  visibleSet(visible: boolean): void {
    this.root.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Returns whether the row is shown.
   *
   * @returns True while shown.
   */
  isVisible(): boolean {
    return this.root.style.display !== 'none';
  }

  /**
   * Returns the row element.
   *
   * @returns Row root.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Removes the row and its hover listeners. */
  dispose(): void {
    this.hoverHost.removeEventListener('pointerenter', this.onPointerEnter);
    this.hoverHost.removeEventListener('pointerleave', this.onPointerLeave);
    this.root.remove();
  }

  /** Places the row at the top-right corner above the view. */
  private rootStyle(): void {
    this.root.classList.add(VIEWPORT_HOVER_BUTTON_ROW_CLASS);
    this.root.style.position = 'absolute';
    this.root.style.top = '2px';
    this.root.style.right = '2px';
    this.root.style.alignItems = 'center';
    this.root.style.gap = '1px';
    this.root.style.zIndex = String(UiStackLayers.viewportChrome);
    this.root.style.userSelect = 'none';
  }

  /**
   * Applies the compact square look of a row button.
   *
   * @param button Row button.
   */
  private buttonStyle(button: HTMLButtonElement): void {
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.width = `${VIEWPORT_HOVER_BUTTON_PX}px`;
    button.style.height = `${VIEWPORT_HOVER_BUTTON_PX}px`;
    button.style.padding = '0';
    button.style.border = '1px solid';
    button.style.borderRadius = '0';
    button.style.color = Theme.buttonTextColor;
    button.style.cursor = 'pointer';
    button.style.lineHeight = '0';
    const icon = button.querySelector('svg');
    icon?.setAttribute('width', String(VIEWPORT_HOVER_ICON_PX));
    icon?.setAttribute('height', String(VIEWPORT_HOVER_ICON_PX));
  }
}
