import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VIEWPORT_HOVER_BUTTON_ROW_CLASS,
  ViewportHoverButtonRow,
} from '@/ui/viewport_chrome/viewport_hover_button_row.js';

/** Icon markup used by the test buttons. */
const VIEWPORT_HOVER_BUTTON_ROW_TEST_ICON = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

/**
 * Creates a hover host attached to the document.
 *
 * @returns Hover host element.
 */
function viewportHoverButtonRowTestHostCreate(): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ViewportHoverButtonRow', () => {
  it('is hidden until the pointer enters the host and hidden again when it leaves', () => {
    const host = viewportHoverButtonRowTestHostCreate();
    const row = new ViewportHoverButtonRow(host);
    expect(row.getElement().parentElement).toBe(host);
    expect(row.getElement().classList.contains(VIEWPORT_HOVER_BUTTON_ROW_CLASS)).toBe(true);
    expect(row.isVisible()).toBe(false);
    host.dispatchEvent(new PointerEvent('pointerenter'));
    expect(row.isVisible()).toBe(true);
    host.dispatchEvent(new PointerEvent('pointerleave'));
    expect(row.isVisible()).toBe(false);
  });

  it('runs the click handler of a button without letting the click reach the host', () => {
    const host = viewportHoverButtonRowTestHostCreate();
    const onHostClick = vi.fn();
    host.addEventListener('click', onHostClick);
    const onClick = vi.fn();
    const button = new ViewportHoverButtonRow(host).buttonAdd('Solid', VIEWPORT_HOVER_BUTTON_ROW_TEST_ICON, onClick);
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(onHostClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-label')).toBe('Solid');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('marks a button as pressed or released', () => {
    const row = new ViewportHoverButtonRow(viewportHoverButtonRowTestHostCreate());
    const button = row.buttonAdd('Maximize', VIEWPORT_HOVER_BUTTON_ROW_TEST_ICON, () => undefined);
    expect(button.dataset['active']).toBe('false');
    row.buttonActiveSet(button, true);
    expect(button.dataset['active']).toBe('true');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    row.buttonActiveSet(button, false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('stops following the pointer and leaves the host after dispose', () => {
    const host = viewportHoverButtonRowTestHostCreate();
    const row = new ViewportHoverButtonRow(host);
    row.dispose();
    host.dispatchEvent(new PointerEvent('pointerenter'));
    expect(row.isVisible()).toBe(false);
    expect(host.contains(row.getElement())).toBe(false);
  });
});
