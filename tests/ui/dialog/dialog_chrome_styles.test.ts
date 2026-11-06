import { describe, it, expect } from 'vitest';
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { cssColorNormalize } from '../ui_css_color_test_support.js';
import {
  dialogChromeActionButtonApply,
  dialogChromePanelApply,
  dialogChromeReadonlyFieldApply,
} from '@/ui/dialog/dialog_chrome_styles.js';

/** Unit tests for the classic dialog chrome helpers. */
describe('dialog_chrome_styles', () => {
  it('gives dialog panels the light face, grey border, black text and requested widths', () => {
    const panel = document.createElement('div');
    const minWidth = 200 + Math.round(Math.random() * 100);
    const maxWidth = minWidth + 150;
    dialogChromePanelApply(panel, minWidth, maxWidth);
    expect(panel.style.minWidth).toBe(`${minWidth}px`);
    expect(panel.style.maxWidth).toBe(`${maxWidth}px`);
    expect(panel.style.background).toContain(cssColorNormalize(hexToRgb(Theme.propertiesPanelBackground)));
    expect(panel.style.borderColor).toBe(cssColorNormalize(Theme.chromeBorderColor));
    expect(panel.style.color).toBe(cssColorNormalize(Theme.buttonTextColor));
  });

  it('gives read-only fields the white sunken input look', () => {
    const field = document.createElement('input');
    dialogChromeReadonlyFieldApply(field);
    expect(field.style.background).toContain(cssColorNormalize(Theme.inputBackgroundColor));
    expect(field.style.borderColor).toBe(cssColorNormalize(Theme.inputBorderColor));
    expect(field.style.color).toBe(cssColorNormalize(Theme.inputTextColor));
  });

  it('gives only the primary action button the accent border', () => {
    const primary = document.createElement('button');
    const secondary = document.createElement('button');
    dialogChromeActionButtonApply(primary, true);
    dialogChromeActionButtonApply(secondary, false);
    expect(primary.style.borderColor).toBe(cssColorNormalize(Theme.toggleActiveBorder));
    expect(secondary.style.borderColor).toBe(cssColorNormalize(Theme.chromeBorderColor));
  });
});
