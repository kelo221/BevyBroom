import { afterEach, describe, expect, it } from 'vitest';
import { Theme } from '@/theme.js';
import { IconHammerCatalog, type IconHammerName } from '@/ui/icons/hammer/icon_hammer_catalog.js';
import { ICON_HAMMER_OUTLINE } from '@/ui/icons/hammer/core/icon_hammer_palette.js';
import { TOOL_RAIL_CATALOG_ORDER } from '@/tools/chrome/rail/tool_rail_catalog.js';

/** Size every catalog check renders the icons at. */
const ICON_HAMMER_TEST_SIZE_PX = 32;

/**
 * Parses icon markup as a standalone SVG document and returns its root.
 *
 * @param markup SVG markup.
 * @returns Root SVG element of the parsed document.
 */
function iconHammerTestParse(markup: string): Element {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0);
  return parsed.documentElement;
}

/**
 * Collects every `url(#id)` reference used by an icon's attributes.
 *
 * @param markup SVG markup.
 * @returns Referenced ids.
 */
function iconHammerTestReferencedIds(markup: string): string[] {
  return [...markup.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1] ?? '');
}

/**
 * Lists the id attribute of every element under a root.
 *
 * @param root Element whose descendants are scanned.
 * @returns Ids in document order.
 */
function iconHammerTestIds(root: ParentNode): string[] {
  return [...root.querySelectorAll('[id]')].map((element) => element.id);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('IconHammerCatalog', () => {
  it('lists each icon name once and has an icon for every rail tool', () => {
    const names = IconHammerCatalog.namesRead();
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    TOOL_RAIL_CATALOG_ORDER.forEach((entry) => expect(names).toContain(entry.iconName));
  });

  it('renders every icon as parseable SVG on the 32 grid at the requested size', () => {
    for (const name of IconHammerCatalog.namesRead()) {
      const root = iconHammerTestParse(IconHammerCatalog.svg(name, ICON_HAMMER_TEST_SIZE_PX));
      expect(root.tagName).toBe('svg');
      expect(root.getAttribute('viewBox')).toBe('0 0 32 32');
      expect(root.getAttribute('width')).toBe(String(ICON_HAMMER_TEST_SIZE_PX));
      expect(root.getAttribute('height')).toBe(String(ICON_HAMMER_TEST_SIZE_PX));
      expect(root.getAttribute('data-icon-hammer')).toBe(name);
    }
  });

  it('draws every icon in full colour with a dark outline instead of the text colour', () => {
    for (const name of IconHammerCatalog.namesRead()) {
      const markup = IconHammerCatalog.svg(name, ICON_HAMMER_TEST_SIZE_PX);
      const root = iconHammerTestParse(markup);
      expect(markup.toLowerCase()).not.toContain('currentcolor');
      expect(root.querySelector(`[stroke="${ICON_HAMMER_OUTLINE}"]`), name).not.toBeNull();
    }
  });

  it('resolves every gradient and clip reference inside the same icon', () => {
    for (const name of IconHammerCatalog.namesRead()) {
      const markup = IconHammerCatalog.svg(name, ICON_HAMMER_TEST_SIZE_PX);
      const ids = new Set(iconHammerTestIds(iconHammerTestParse(markup)));
      iconHammerTestReferencedIds(markup).forEach((id) => expect(ids.has(id), `${name} -> ${id}`).toBe(true));
    }
  });

  it('gives two copies of every icon on one page distinct element ids', () => {
    const names: IconHammerName[] = IconHammerCatalog.namesRead();
    document.body.innerHTML = names
      .map((name) => IconHammerCatalog.svg(name, 24) + IconHammerCatalog.svg(name, 32))
      .join('');
    const ids = iconHammerTestIds(document.body);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders palette and toolbar icons at the theme icon sizes', () => {
    const name = IconHammerCatalog.namesRead()[0] ?? 'tool_selection';
    const palette = iconHammerTestParse(IconHammerCatalog.paletteSvg(name));
    const toolbar = iconHammerTestParse(IconHammerCatalog.toolbarSvg(name));
    expect(palette.getAttribute('width')).toBe(String(Theme.toolPaletteIconPx));
    expect(toolbar.getAttribute('width')).toBe(String(Theme.toolbarIconPx));
  });
});
