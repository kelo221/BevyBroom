import { describe, expect, it, vi } from 'vitest';
import {
  buttonCompactActiveRead,
  buttonCompactActiveWrite,
  buttonCompactCreate,
  buttonCompactEnabledWrite,
} from '@/ui/button/button_compact.js';

/** Unit tests for the shared compact button factory. */
describe('buttonCompactCreate', () => {
  it('shows the title as text and accessible name and runs the click without bubbling', () => {
    const onClick = vi.fn();
    const parentClick = vi.fn();
    const parent = document.createElement('div');
    parent.addEventListener('click', parentClick);
    const button = buttonCompactCreate({ title: 'Apply', widthPx: null, heightPx: 22, onClick });
    parent.appendChild(button);
    button.click();
    expect(button.type).toBe('button');
    expect(button.textContent).toBe('Apply');
    expect(button.getAttribute('aria-label')).toBe('Apply');
    expect(onClick).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('prefers explicit text and applies a fixed width when given', () => {
    const widthPx = 31;
    const button = buttonCompactCreate({ title: 'Rotate left', text: 'L', widthPx, heightPx: 20, onClick: vi.fn() });
    expect(button.textContent).toBe('L');
    expect(button.style.width).toBe(`${widthPx}px`);
  });

  it('ignores clicks while disabled and accepts them again once enabled', () => {
    const onClick = vi.fn();
    const button = buttonCompactCreate({ title: 'Mark', widthPx: null, heightPx: 22, onClick });
    buttonCompactEnabledWrite(button, false);
    expect(button.disabled).toBe(true);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    buttonCompactEnabledWrite(button, true);
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('restores the active tint, not the idle background, when the pointer leaves', () => {
    const activeButton = buttonCompactCreate({ title: 'Hide mask', widthPx: null, heightPx: 22, onClick: vi.fn() });
    const idleButton = buttonCompactCreate({ title: 'Mark', widthPx: null, heightPx: 22, onClick: vi.fn() });
    buttonCompactActiveWrite(activeButton, true);
    const activeBackground = activeButton.style.background;
    expect(activeBackground).not.toBe(idleButton.style.background);
    activeButton.dispatchEvent(new MouseEvent('mouseenter'));
    expect(activeButton.style.background).not.toBe(activeBackground);
    activeButton.dispatchEvent(new MouseEvent('mouseleave'));
    expect(activeButton.style.background).toBe(activeBackground);
    expect(buttonCompactActiveRead(activeButton)).toBe(true);
  });

  it('returns to the idle background after the active state is cleared', () => {
    const button = buttonCompactCreate({ title: 'Fit', widthPx: 26, heightPx: 22, onClick: vi.fn() });
    const idleBackground = button.style.background;
    buttonCompactActiveWrite(button, true);
    buttonCompactActiveWrite(button, false);
    button.dispatchEvent(new MouseEvent('mouseenter'));
    button.dispatchEvent(new MouseEvent('mouseleave'));
    expect(button.style.background).toBe(idleBackground);
    expect(buttonCompactActiveRead(button)).toBe(false);
  });

  it('keeps its own size inside a flex column instead of stretching to its width', () => {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    const heightPx = 22;
    const widthPx = 72;
    const button = buttonCompactCreate({ title: 'Browse…', widthPx, heightPx, onClick: vi.fn() });
    column.appendChild(button);
    document.body.appendChild(column);
    const computed = getComputedStyle(button);
    expect(computed.flexGrow).toBe('0');
    expect(computed.flexShrink).toBe('0');
    expect(computed.flexBasis).toBe('auto');
    expect(button.style.height).toBe(`${heightPx}px`);
    column.remove();
  });
});
