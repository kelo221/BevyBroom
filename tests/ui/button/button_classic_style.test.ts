import { describe, it, expect } from 'vitest';
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { cssColorNormalize } from '../ui_css_color_test_support.js';
import {
  buttonClassicHoverBind,
  buttonClassicPressedApply,
  buttonClassicPrimaryApply,
  buttonClassicStyleApply,
} from '@/ui/button/button_classic_style.js';

/** Unit tests for the classic Windows button look. */
describe('button_classic_style', () => {
  it('styles a resting button with the light face, grey border and black chrome text', () => {
    const button = document.createElement('button');
    buttonClassicStyleApply(button);
    expect(button.style.background).toContain(cssColorNormalize(hexToRgb(Theme.buttonBackground)));
    expect(button.style.borderColor).toBe(cssColorNormalize(Theme.chromeBorderColor));
    expect(button.style.color).toBe(cssColorNormalize(Theme.buttonTextColor));
    expect(button.style.fontSize).toBe(`${Theme.uiFontSizePx}px`);
  });

  it('shows the pressed face and accent border while toggled and restores them when released', () => {
    const button = document.createElement('button');
    buttonClassicStyleApply(button);
    buttonClassicPressedApply(button, true);
    expect(button.style.background).toContain(cssColorNormalize(Theme.buttonPressedBackground));
    expect(button.style.borderColor).toBe(cssColorNormalize(Theme.toggleActiveBorder));
    buttonClassicPressedApply(button, false);
    expect(button.style.background).toContain(cssColorNormalize(hexToRgb(Theme.buttonBackground)));
    expect(button.style.borderColor).toBe(cssColorNormalize(Theme.chromeBorderColor));
  });

  it('marks the default action with the accent border', () => {
    const button = document.createElement('button');
    buttonClassicStyleApply(button);
    buttonClassicPrimaryApply(button);
    expect(button.style.borderColor).toBe(cssColorNormalize(Theme.toggleActiveBorder));
  });

  it('lightens on hover and returns to the face of its current state on leave', () => {
    const button = document.createElement('button');
    let isPressed = false;
    buttonClassicStyleApply(button);
    buttonClassicHoverBind(button, () => isPressed);
    button.dispatchEvent(new MouseEvent('mouseenter'));
    expect(button.style.background).toContain(cssColorNormalize(hexToRgb(Theme.buttonHoverColor)));
    isPressed = true;
    button.dispatchEvent(new MouseEvent('mouseleave'));
    expect(button.style.background).toContain(cssColorNormalize(Theme.buttonPressedBackground));
  });
});
