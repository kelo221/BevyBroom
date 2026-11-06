import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_LABEL_CLASS, ViewportLabel } from '@/ui/viewport_chrome/viewport_label.js';
import { Theme } from '@/theme.js';

/**
 * Creates a parent element attached to the document.
 *
 * @returns Parent element.
 */
function viewportLabelTestParentCreate(): HTMLElement {
  const parentElement = document.createElement('div');
  document.body.appendChild(parentElement);
  return parentElement;
}

/**
 * Returns how the browser reports a colour once written to an inline style.
 *
 * @param property Style property receiving the colour.
 * @param colour Colour value written.
 * @returns Normalised colour string.
 */
function viewportLabelTestStyleColourRead(property: 'color' | 'background', colour: string): string {
  const probe = document.createElement('span');
  probe.style[property] = colour;
  return probe.style[property];
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ViewportLabel', () => {
  it('creates a clickable menu button with the given text inside the parent', () => {
    const parentElement = viewportLabelTestParentCreate();
    const label = new ViewportLabel(parentElement, 'top (x/z)', () => undefined);
    const labelElement = label.getLabelElement();
    expect(labelElement.parentElement).toBe(parentElement);
    expect(labelElement.tagName).toBe('BUTTON');
    expect(labelElement.classList.contains(VIEWPORT_LABEL_CLASS)).toBe(true);
    expect(labelElement.textContent).toBe('top (x/z)');
    expect(labelElement.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('runs the click handler without letting the click reach the viewport', () => {
    const parentElement = viewportLabelTestParentCreate();
    const onClick = vi.fn();
    const onParentClick = vi.fn();
    parentElement.addEventListener('click', onParentClick);
    new ViewportLabel(parentElement, 'camera', onClick).getLabelElement().click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('replaces its text and names the view in the tooltip', () => {
    const label = new ViewportLabel(viewportLabelTestParentCreate(), 'camera', () => undefined);
    label.textSet('front (x/y)', 'Front');
    expect(label.getLabelElement().textContent).toBe('front (x/y)');
    expect(label.getLabelElement().title).toContain('Front');
  });

  it('reports whether its menu is expanded', () => {
    const label = new ViewportLabel(viewportLabelTestParentCreate(), 'camera', () => undefined);
    expect(label.getLabelElement().getAttribute('aria-expanded')).toBe('false');
    label.expandedSet(true);
    expect(label.getLabelElement().getAttribute('aria-expanded')).toBe('true');
    label.expandedSet(false);
    expect(label.getLabelElement().getAttribute('aria-expanded')).toBe('false');
  });

  it('uses the theme label colours and label height', () => {
    const labelElement = new ViewportLabel(
      viewportLabelTestParentCreate(),
      'camera',
      () => undefined,
    ).getLabelElement();
    expect(labelElement.style.color).toBe(viewportLabelTestStyleColourRead('color', Theme.viewportLabelTextColor));
    expect(labelElement.style.background).toBe(
      viewportLabelTestStyleColourRead('background', Theme.viewportLabelBackgroundColor),
    );
    expect(labelElement.style.height).toBe(`${Theme.viewportLabelHeightPx}px`);
  });
});
