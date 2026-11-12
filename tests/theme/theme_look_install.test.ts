import { describe, expect, it } from 'vitest';
import { THEME_LOOK_STYLE_ELEMENT_ID, themeLookInstall } from '@/theme/theme_look_install.js';
import { THEME_MAC_GLASS_ROOT_SELECTOR } from '@/theme/mac_glass/theme_mac_glass_stylesheet.js';

/**
 * Creates an empty document to install looks into.
 *
 * @returns Fresh document.
 */
function themeLookTestDocumentCreate(): Document {
  return document.implementation.createHTMLDocument('theme look');
}

describe('themeLookInstall', () => {
  it('adds one glass stylesheet scoped to the glass root and marks the document', () => {
    const targetDocument = themeLookTestDocumentCreate();
    themeLookInstall(targetDocument, 'mac_glass');
    themeLookInstall(targetDocument, 'mac_glass');
    const styles = targetDocument.querySelectorAll(`#${THEME_LOOK_STYLE_ELEMENT_ID}`);
    expect(styles).toHaveLength(1);
    expect(targetDocument.documentElement.dataset['themeLook']).toBe('mac_glass');
    expect(targetDocument.documentElement.matches(THEME_MAC_GLASS_ROOT_SELECTOR)).toBe(true);
    const cssRules = (styles[0]?.textContent ?? '').split('\n').filter((rule) => rule.trim() !== '');
    expect(cssRules.length).toBeGreaterThan(0);
    expect(cssRules.every((rule) => rule.startsWith(THEME_MAC_GLASS_ROOT_SELECTOR))).toBe(true);
  });

  it('adds no stylesheet for the classic look', () => {
    const targetDocument = themeLookTestDocumentCreate();
    themeLookInstall(targetDocument, 'classic');
    expect(targetDocument.getElementById(THEME_LOOK_STYLE_ELEMENT_ID)).toBeNull();
    expect(targetDocument.documentElement.matches(THEME_MAC_GLASS_ROOT_SELECTOR)).toBe(false);
  });
});
