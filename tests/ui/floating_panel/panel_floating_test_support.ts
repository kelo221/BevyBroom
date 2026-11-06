import type { PanelFloating } from '@/ui/floating_panel/panel_floating.js';

/**
 * Stubs getBoundingClientRect for layout-sensitive placement tests.
 *
 * @param element Target element.
 * @param rect Partial DOM rect values.
 */
export function stubBoundingRect(
  element: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  });
}

/**
 * Stubs panel size from style left/top so clamp uses the placed coordinates.
 *
 * @param element Panel root element.
 * @param width Panel width.
 * @param height Panel height.
 */
export function stubPanelRectFromStyle(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      const left = parseFloat(element.style.left) || 0;
      const top = parseFloat(element.style.top) || 0;
      return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
      };
    },
  });
}

/**
 * Sets the browser window size seen by screen clamping.
 *
 * @param width Window width in pixels.
 * @param height Window height in pixels.
 */
export function windowSizeSet(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

/**
 * Drags a title bar by a pointer offset.
 *
 * @param titleBar Title bar element.
 * @param startX Pointer start X in client pixels.
 * @param startY Pointer start Y in client pixels.
 * @param deltaX Horizontal drag distance.
 * @param deltaY Vertical drag distance.
 */
export function titleBarDrag(
  titleBar: HTMLElement,
  startX: number,
  startY: number,
  deltaX: number,
  deltaY: number,
): void {
  titleBar.dispatchEvent(
    new PointerEvent('pointerdown', { button: 0, clientX: startX, clientY: startY, bubbles: true }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + deltaX, clientY: startY + deltaY }));
  window.dispatchEvent(new PointerEvent('pointerup', {}));
}

/**
 * Reads the CSS left/top of a panel root in pixels.
 *
 * @param panel Panel to read.
 * @returns Left and top.
 */
export function panelLeftTopRead(panel: PanelFloating): { left: number; top: number } {
  const root = panel.getRootElement();
  return { left: parseFloat(root.style.left), top: parseFloat(root.style.top) };
}
