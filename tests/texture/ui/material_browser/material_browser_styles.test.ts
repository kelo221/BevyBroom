import { describe, it, expect, afterEach } from 'vitest';
import {
  MATERIAL_BROWSER_THUMB_CLASS,
  MATERIAL_BROWSER_TILE_CLASS,
  MATERIAL_BROWSER_GRID_CLASS,
  MATERIAL_BROWSER_MIN_TRACK_PX,
  materialBrowserStylesheetEnsure,
} from '@/texture/ui/material_browser/material_browser_styles.js';

/** DOM id of the material browser stylesheet. */
const MATERIAL_BROWSER_STYLESHEET_ID = 'tb-browser-stylesheet';

/**
 * Proves the material browser stylesheet is injected once and sizes square
 * thumbnails through container queries in an auto-fill grid.
 */
describe('material_browser_styles', () => {
  afterEach(() => {
    document.getElementById(MATERIAL_BROWSER_STYLESHEET_ID)?.remove();
  });

  it('injects a single stylesheet element', () => {
    materialBrowserStylesheetEnsure();
    materialBrowserStylesheetEnsure();
    const sheets = document.querySelectorAll(`#${MATERIAL_BROWSER_STYLESHEET_ID}`);
    expect(sheets).toHaveLength(1);
    expect(stylesheetText()).toContain(`.${MATERIAL_BROWSER_THUMB_CLASS}`);
    expect(stylesheetText()).toContain(`.${MATERIAL_BROWSER_GRID_CLASS}`);
  });

  it('sizes thumbs with container-query height matching tile width', () => {
    materialBrowserStylesheetEnsure();
    const css = stylesheetText();
    expect(css).toContain('height: 100cqi');
    expect(css).toContain('container-type: inline-size');
    expect(css).toContain('width: 100%');
    expect(css).toContain(`repeat(auto-fill, minmax(${MATERIAL_BROWSER_MIN_TRACK_PX}px, 1fr))`);
    expect(css).toContain('grid-auto-rows: max-content');
    expect(css).not.toContain('padding-top: 100%');
  });

  it('does not use overflow hidden on tiles (collapses grid min-size)', () => {
    materialBrowserStylesheetEnsure();
    const tileBlock = extractRule(stylesheetText(), `.${MATERIAL_BROWSER_TILE_CLASS}`);
    expect(tileBlock).not.toMatch(/overflow:\s*hidden/);
  });
});

/**
 * Returns the text of the injected material browser stylesheet.
 *
 * @returns Stylesheet text, empty when missing.
 */
function stylesheetText(): string {
  return document.getElementById(MATERIAL_BROWSER_STYLESHEET_ID)?.textContent ?? '';
}

/**
 * Returns the body of the first CSS rule whose selector matches exactly.
 *
 * @param css Full stylesheet text.
 * @param selector Selector including the leading dot.
 * @returns Rule body text without braces.
 */
function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? '';
}
