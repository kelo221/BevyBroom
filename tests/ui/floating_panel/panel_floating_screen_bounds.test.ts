import { describe, it, expect } from 'vitest';
import {
  clampFloatingPanelRectToScreen,
  floatingPanelCenterInBounds,
  FLOATING_PANEL_SCREEN_PADDING_PX,
} from '@/ui/floating_panel/panel_floating_screen_bounds.js';

describe('clampFloatingPanelRectToScreen', () => {
  it('keeps a panel inside a large window', () => {
    const clamped = clampFloatingPanelRectToScreen({ left: -40, top: 10, width: 200, height: 100 }, 1000, 800);
    expect(clamped.left).toBe(FLOATING_PANEL_SCREEN_PADDING_PX);
    expect(clamped.top).toBe(10);
  });

  it('clamps right and bottom overflow', () => {
    const clamped = clampFloatingPanelRectToScreen({ left: 900, top: 700, width: 200, height: 100 }, 1000, 800);
    expect(clamped.left).toBe(1000 - 200 - FLOATING_PANEL_SCREEN_PADDING_PX);
    expect(clamped.top).toBe(800 - 100 - FLOATING_PANEL_SCREEN_PADDING_PX);
  });

  it('keeps oversized panels at the padding inset', () => {
    const clamped = clampFloatingPanelRectToScreen({ left: 50, top: 50, width: 2000, height: 1500 }, 1000, 800);
    expect(clamped.left).toBe(FLOATING_PANEL_SCREEN_PADDING_PX);
    expect(clamped.top).toBe(FLOATING_PANEL_SCREEN_PADDING_PX);
  });
});

describe('floatingPanelCenterInBounds', () => {
  it('puts the panel center on the bounds center', () => {
    const bounds = { left: 40, top: 30, width: 900, height: 500 };
    const panelSize = { width: 300, height: 200 };
    const centered = floatingPanelCenterInBounds(bounds, panelSize.width, panelSize.height);
    expect(centered.left + panelSize.width / 2).toBeCloseTo(bounds.left + bounds.width / 2, 0);
    expect(centered.top + panelSize.height / 2).toBeCloseTo(bounds.top + bounds.height / 2, 0);
  });

  it('returns whole pixels for odd sizes', () => {
    const centered = floatingPanelCenterInBounds({ left: 0, top: 0, width: 101, height: 77 }, 40, 20);
    expect(Number.isInteger(centered.left)).toBe(true);
    expect(Number.isInteger(centered.top)).toBe(true);
  });
});
