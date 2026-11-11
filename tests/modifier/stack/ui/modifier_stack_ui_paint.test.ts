import { describe, expect, it } from 'vitest';
import { Theme } from '@/theme.js';
import { modifierStackUiPaint } from '@/modifier/stack/ui/modifier_stack_ui_paint.js';
import {
  PanelPropertiesModifierStackSection,
  MODIFIER_STACK_SECTION_CAPTURE_HINT,
} from '@/modifier/stack/ui/panel_properties_modifier_stack_section.js';

/**
 * Normalizes a CSS colour the way the DOM stores it.
 *
 * @param color Any CSS colour.
 * @returns Normalized colour.
 */
function css(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  return probe.style.color;
}

describe('modifier stack inspector theme paint', () => {
  it('paints text, muted eyes and warnings in the Hammer theme colours', () => {
    const text = modifierStackUiPaint(document.createElement('span'), 'text');
    const eyeOff = modifierStackUiPaint(document.createElement('button'), 'eyeOff');
    const report = modifierStackUiPaint(document.createElement('div'), 'error');
    expect(text.style.color).toBe(css(Theme.buttonTextColor));
    expect(eyeOff.style.color).toBe(css(Theme.disabledTextColor));
    expect(report.style.color).toBe(css(Theme.severityWarningColor));
  });

  it('frames cards with the panel face and a thin chrome border', () => {
    const card = modifierStackUiPaint(document.createElement('div'), 'card');
    const probe = document.createElement('div');
    probe.style.border = `1px solid ${Theme.chromeBorderColor}`;
    probe.style.background = Theme.panelBackground;
    expect(card.style.border).toBe(probe.style.border);
    expect(card.style.background).toBe(probe.style.background);
  });

  it('explains on the status line that volumes never capture other volumes', () => {
    const section = new PanelPropertiesModifierStackSection(
      () => document.createElement('section'),
      (title) => Object.assign(document.createElement('header'), { textContent: title }),
    );
    const titled = [...section.getElement().querySelectorAll<HTMLElement>('[title]')].map((node) => node.title);
    expect(titled.some((title) => title === MODIFIER_STACK_SECTION_CAPTURE_HINT)).toBe(true);
    expect(MODIFIER_STACK_SECTION_CAPTURE_HINT).toContain('loop');
  });
});
