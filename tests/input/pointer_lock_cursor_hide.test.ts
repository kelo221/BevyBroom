import { afterEach, describe, expect, it } from 'vitest';
import { POINTER_LOCK_CURSOR_HIDE_CLASS, PointerLockCursorHide } from '@/input/pointer_lock_cursor_hide.js';

/**
 * The cursor hide rule hides the mouse cursor over every element of a document,
 * even over elements with their own inline cursor, and only while it is on.
 */
describe('PointerLockCursorHide', () => {
  afterEach(() => {
    PointerLockCursorHide.show(document);
    document.body.replaceChildren();
  });

  it('hides the cursor on the whole document, over inline cursors too, and shows it again', () => {
    const canvas = document.createElement('canvas');
    canvas.style.cursor = 'crosshair';
    document.body.appendChild(canvas);
    PointerLockCursorHide.hide(document);
    expect(document.documentElement.classList.contains(POINTER_LOCK_CURSOR_HIDE_CLASS)).toBe(true);
    expect(getComputedStyle(canvas).cursor).toBe('none');
    PointerLockCursorHide.show(document);
    expect(PointerLockCursorHide.isHidden(document)).toBe(false);
    expect(getComputedStyle(canvas).cursor).toBe('crosshair');
  });

  it('adds its rule to a document only once', () => {
    PointerLockCursorHide.hide(document);
    PointerLockCursorHide.show(document);
    PointerLockCursorHide.hide(document);
    const rules = document.head.querySelectorAll('style');
    const hideRules = [...rules].filter((rule) => rule.textContent?.includes(POINTER_LOCK_CURSOR_HIDE_CLASS));
    expect(hideRules).toHaveLength(1);
  });
});
