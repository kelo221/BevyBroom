import { describe, expect, it, vi } from 'vitest';
import { Theme } from '@/theme.js';
import {
  SHELL_DOCK_COMPACT_CONTROL_CLASS,
  SHELL_DOCK_COMPACT_FIELD_BASIS_PX,
  SHELL_DOCK_COMPACT_GAP_PX,
  shellDockCompactButtonCreate,
  shellDockCompactButtonStyle,
  shellDockCompactFieldStyle,
  shellDockCompactRowStyle,
} from '@/layout/shell/dock/shell_dock_compact.js';

/** Unit tests for the compact dock control sizing. */
describe('shell dock compact controls', () => {
  it('creates a dock height button that shrinks with an ellipsis and keeps its label as tooltip', () => {
    const onClick = vi.fn();
    const label = `A long dock button label ${Theme.rightDockWidthPx}`;
    const button = shellDockCompactButtonCreate(label, onClick);
    expect(button.textContent).toBe(label);
    expect(button.title).toBe(label);
    expect(button.classList.contains(SHELL_DOCK_COMPACT_CONTROL_CLASS)).toBe(true);
    expect(button.style.height).toBe(`${Theme.dockControlHeightPx}px`);
    expect(button.style.fontSize).toBe(`${Theme.uiFontSizePx}px`);
    expect(button.style.minWidth).toMatch(/^0(px)?$/);
    expect(button.style.textOverflow).toBe('ellipsis');
    expect(button.style.whiteSpace).toBe('nowrap');
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('gives an untitled button its text as tooltip and keeps an existing tooltip', () => {
    const untitled = document.createElement('button');
    untitled.textContent = 'Objects';
    shellDockCompactButtonStyle(untitled);
    expect(untitled.title).toBe('Objects');
    const titled = document.createElement('button');
    titled.textContent = 'Go';
    titled.title = 'Go somewhere';
    shellDockCompactButtonStyle(titled);
    expect(titled.title).toBe('Go somewhere');
  });

  it('lets a field move below its caption by giving it a flex basis no wider than the dock', () => {
    const field = document.createElement('select');
    shellDockCompactFieldStyle(field);
    expect(field.style.height).toBe(`${Theme.dockControlHeightPx}px`);
    expect(field.style.flex).toContain(`${SHELL_DOCK_COMPACT_FIELD_BASIS_PX}px`);
    expect(SHELL_DOCK_COMPACT_FIELD_BASIS_PX).toBeLessThan(Theme.rightDockWidthPx);
    expect(field.style.minWidth).toMatch(/^0(px)?$/);
  });

  it('lays a row out as a wrapping line with the compact gap', () => {
    const row = document.createElement('div');
    shellDockCompactRowStyle(row);
    expect(row.style.display).toBe('flex');
    expect(row.style.flexWrap).toBe('wrap');
    expect(row.style.gap).toBe(`${SHELL_DOCK_COMPACT_GAP_PX}px`);
  });
});
