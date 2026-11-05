/** Inline SVG icon markup for Hammer++ palette tools and quick toolbar buttons. */
export class ToolbarIconsHammer {
  /**
   * Entity placement lightbulb icon.
   *
   * @returns SVG markup string.
   */
  static toolEntity(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.6" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.6.5 1.1 1.2 1.3 2h5c.2-.8.7-1.5 1.3-2A6 6 0 0 0 12 3z"/>',
    );
  }

  /**
   * Block brush creation cube icon.
   *
   * @returns SVG markup string.
   */
  static toolBlock(): string {
    return this.wrapSvg(
      '<path fill="currentColor" opacity="0.3" d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12v9M4 7.5l8 4.5 8-4.5"/>',
    );
  }

  /**
   * Apply current texture stamp icon.
   *
   * @returns SVG markup string.
   */
  static toolTextureStamp(): string {
    return this.wrapSvg(
      '<rect x="4" y="4" width="7" height="7" fill="currentColor" opacity="0.75"/><rect x="13" y="4" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="13" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="7" height="7" fill="currentColor" opacity="0.75"/>',
    );
  }

  /**
   * Vertex editing tool icon (wireframe cube with corner dots).
   *
   * @returns SVG markup string.
   */
  static toolVertex(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.3" d="M6 6h12v12H6z"/><circle cx="6" cy="6" r="2.2" fill="currentColor"/><circle cx="18" cy="6" r="2.2" fill="currentColor"/><circle cx="6" cy="18" r="2.2" fill="currentColor"/><circle cx="18" cy="18" r="2.2" fill="currentColor"/>',
    );
  }

  /**
   * Polygon 2D polyline extrude brush icon.
   *
   * @returns SVG markup string.
   */
  static toolPolygon(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.6" d="M6 5 18 7 19 17 11 19 5 13Z"/><circle cx="6" cy="5" r="2" fill="currentColor"/><circle cx="18" cy="7" r="2" fill="currentColor"/><circle cx="19" cy="17" r="2" fill="currentColor"/><circle cx="11" cy="19" r="2" fill="currentColor"/><circle cx="5" cy="13" r="2" fill="currentColor"/>',
    );
  }

  /**
   * Sprinkle scatter tool icon (dice dots).
   *
   * @returns SVG markup string.
   */
  static toolSprinkle(): string {
    return this.wrapSvg(
      '<rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/>',
    );
  }

  /**
   * Group objects icon.
   *
   * @returns SVG markup string.
   */
  static group(): string {
    return this.wrapSvg(
      '<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"/><rect x="7" y="7" width="4.5" height="4.5" fill="currentColor"/><rect x="12.5" y="12.5" width="4.5" height="4.5" fill="currentColor"/>',
    );
  }

  /**
   * Ungroup objects icon.
   *
   * @returns SVG markup string.
   */
  static ungroup(): string {
    return this.wrapSvg(
      '<rect x="5" y="5" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path stroke="currentColor" stroke-width="1.5" d="M5 19 19 5"/>',
    );
  }

  /**
   * Ignore groups toggle icon.
   *
   * @returns SVG markup string.
   */
  static ignoreGroups(): string {
    return this.wrapSvg(
      '<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="7" y="15.5" fill="currentColor" font-size="9" font-family="sans-serif" font-weight="bold">ig</text>',
    );
  }

  /**
   * Cordon bounds box toggle icon.
   *
   * @returns SVG markup string.
   */
  static cordon(): string {
    return this.wrapSvg(
      '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="4 2"/><rect x="8" y="8" width="8" height="8" fill="currentColor" opacity="0.35"/>',
    );
  }

  /**
   * Eyedropper target picker icon.
   *
   * @returns SVG markup string.
   */
  static eyedropper(): string {
    return this.wrapSvg(
      '<path fill="none" stroke="currentColor" stroke-width="1.6" d="m14 6 4 4M5 19l4-1 9-9-3-3-9 9-1 4z"/>',
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
