import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPLITTER_BOX_DIVIDER_PX, SplitterBox, type SplitterBoxOptions } from '@/ui/splitter/splitter_box.js';

/** Root length the tests pretend the browser measured. */
const MEASURED_SPAN_PX = 1000;

/**
 * Builds a mounted splitter box whose root reports a measured size.
 *
 * @param overrides Options that differ from a right-hand inspector layout.
 * @returns Splitter box.
 */
function splitterCreate(overrides: Partial<SplitterBoxOptions> = {}): SplitterBox {
  const splitter = new SplitterBox({
    orientation: 'horizontal',
    sizedPane: 'second',
    initialSizePx: 350,
    minSizedPx: 300,
    minFlexiblePx: 100,
    ...overrides,
  });
  const root = splitter.getElement();
  root.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: MEASURED_SPAN_PX, height: MEASURED_SPAN_PX, right: 0, bottom: 0 }) as DOMRect;
  document.body.appendChild(root);
  return splitter;
}

/**
 * Drags the divider by a distance along the split axis.
 *
 * @param splitter Splitter to drag.
 * @param travelPx Pointer travel in CSS pixels.
 * @param isHorizontal True when the pointer moves along X.
 */
function dividerDrag(splitter: SplitterBox, travelPx: number, isHorizontal: boolean): void {
  const divider = splitter.getElement().querySelector<HTMLElement>('.splitter-box-divider');
  const start = 500;
  const axis = (value: number) => (isHorizontal ? { clientX: value, clientY: 0 } : { clientX: 0, clientY: value });
  divider?.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 3, ...axis(start) }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, ...axis(start + travelPx) }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, ...axis(start + travelPx) }));
}

describe('SplitterBox', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('gives the sized pane its pixel size and lets the other pane flex', () => {
    const splitter = splitterCreate();
    expect(splitter.getSecondPane().style.flex).toBe('0 0 350px');
    expect(splitter.getFirstPane().style.flex).toBe('1 1 0px');
    splitter.dispose();
  });

  it('grows a second pane when the divider is dragged toward the first pane', () => {
    const splitter = splitterCreate();
    const before = splitter.getSizedPaneSizePx();
    dividerDrag(splitter, -80, true);
    expect(splitter.getSizedPaneSizePx()).toBe(before + 80);
    splitter.dispose();
  });

  it('grows a first pane when the divider is dragged away from it', () => {
    const splitter = splitterCreate({
      orientation: 'vertical',
      sizedPane: 'first',
      initialSizePx: 200,
      minSizedPx: 50,
    });
    const before = splitter.getSizedPaneSizePx();
    dividerDrag(splitter, 60, false);
    expect(splitter.getSizedPaneSizePx()).toBe(before + 60);
    splitter.dispose();
  });

  it('keeps the size within both minimum sizes', () => {
    const splitter = splitterCreate();
    splitter.setSizedPaneSizePx(10);
    expect(splitter.getSizedPaneSizePx()).toBe(300);
    splitter.setSizedPaneSizePx(MEASURED_SPAN_PX * 2);
    expect(splitter.getSizedPaneSizePx()).toBe(MEASURED_SPAN_PX - 100 - SPLITTER_BOX_DIVIDER_PX);
    splitter.dispose();
  });

  it('hides the sized pane and divider when collapsed and restores the same size', () => {
    const splitter = splitterCreate();
    const listener = vi.fn();
    splitter.changeListenerAdd(listener);
    splitter.setSizedPaneCollapsed(true);
    expect(splitter.getSecondPane().style.display).toBe('none');
    expect(splitter.isSizedPaneCollapsed()).toBe(true);
    splitter.setSizedPaneCollapsed(false);
    expect(splitter.getSecondPane().style.display).toBe('flex');
    expect(listener).toHaveBeenLastCalledWith(350, false);
    expect(listener).toHaveBeenCalledTimes(2);
    splitter.dispose();
  });

  it('ignores divider presses with other buttons', () => {
    const splitter = splitterCreate();
    const divider = splitter.getElement().querySelector<HTMLElement>('.splitter-box-divider');
    divider?.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: 500 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 }));
    expect(splitter.getSizedPaneSizePx()).toBe(350);
    splitter.dispose();
  });
});
