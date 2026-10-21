import { Theme } from '@/theme.js';

/** Themed color swatch used by inspector rows. */
export class InputColor {
  private readonly element: HTMLInputElement;
  private commitHandler: (() => void) | null;

  /**
   * Creates a color swatch.
   *
   * @param ariaLabel Accessible name.
   */
  constructor(ariaLabel: string) {
    this.element = document.createElement('input');
    this.element.type = 'color';
    this.element.setAttribute('aria-label', ariaLabel);
    this.commitHandler = null;
    this.applyChrome();
    this.element.addEventListener('change', () => this.commitHandler?.());
  }

  /**
   * Returns the input element.
   *
   * @returns Color input DOM node.
   */
  getElement(): HTMLInputElement {
    return this.element;
  }

  /**
   * Shows the shared color, or the first color with a mixed marker when the
   * values differ.
   *
   * @param colorHexValues Per-object colors as 0xRRGGBB numbers.
   */
  setSharedValues(colorHexValues: readonly number[]): void {
    const first = colorHexValues[0] ?? 0xffffff;
    const mixed = colorHexValues.some((value) => value !== first);
    this.element.value = inputColorHexToCss(first);
    this.element.title = mixed ? 'Mixed colors' : this.element.value;
  }

  /**
   * Returns the chosen color.
   *
   * @returns Color as a 0xRRGGBB number.
   */
  getHexValue(): number {
    return Number.parseInt(this.element.value.slice(1), 16) || 0;
  }

  /**
   * Binds the handler called when the user picks a color.
   *
   * @param onCommit Commit handler.
   */
  bindCommit(onCommit: () => void): void {
    this.commitHandler = onCommit;
  }

  /** Applies the inspector input chrome. */
  private applyChrome(): void {
    this.element.style.height = '24px';
    this.element.style.padding = '0 2px';
    this.element.style.border = `1px solid ${Theme.inputBorderColor}`;
    this.element.style.borderRadius = '2px';
    this.element.style.background = Theme.inputBackgroundColor;
    this.element.style.cursor = 'pointer';
  }
}

/**
 * Formats a 0xRRGGBB number as a CSS #rrggbb string.
 *
 * @param colorHex Color number.
 * @returns Lowercase CSS hex color.
 */
export function inputColorHexToCss(colorHex: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.round(colorHex)));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}
