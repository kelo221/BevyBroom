/**
 * Inline SVG icon markup for editor toolbars. Icons use currentColor so button
 * text color styles them.
 */
export class ToolbarIcons {
  /**
   * Floor align icon (horizontal plane).
   *
   * @returns SVG markup string.
   */
  static alignFloor(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 14h16M6 14l2 5h8l2-5M8 14V9h8v5"/>',
    );
  }

  /**
   * Wall align icon (vertical plane).
   *
   * @returns SVG markup string.
   */
  static alignWall(): string {
    return this.wrapSvg('<path fill="none" stroke="currentColor" stroke-width="1.6" d="M7 4h10v16H7zM7 12h10"/>');
  }

  /**
   * Ceiling align icon (plane above).
   *
   * @returns SVG markup string.
   */
  static alignCeiling(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 10h16M6 10l2-5h8l2 5M8 10v5h8v-5"/>',
    );
  }

  /**
   * Texture reset icon (circular arrow).
   *
   * @returns SVG markup string.
   */
  static textureReset(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.6" d="M7 8a6 6 0 1 1-1.5 6.5M7 8V4M7 8h4"/>',
    );
  }

  /**
   * Wraps path content in a standard 24x24 SVG element.
   *
   * @param content Inner SVG path markup.
   * @returns Complete SVG element markup.
   */
  private static wrapSvg(content: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">${content}</svg>`;
  }
}
