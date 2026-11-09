/** Wheel delta of one scroll-up notch. */
export const INPUT_WHEEL_TEST_NOTCH_UP: WheelEventInit = { deltaY: -100 };

/** Wheel delta of one scroll-down notch. */
export const INPUT_WHEEL_TEST_NOTCH_DOWN: WheelEventInit = { deltaY: 100 };

/**
 * Builds a bubbling, cancelable wheel event.
 *
 * @param init Wheel deltas and modifier keys.
 * @returns Wheel event.
 */
export function inputWheelTestEventCreate(init: WheelEventInit): WheelEvent {
  return new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
}

/**
 * Dispatches one wheel event on an element.
 *
 * @param target Element under the pointer.
 * @param init Wheel deltas and modifier keys.
 * @returns The dispatched event, to check whether it was consumed.
 */
export function inputWheelTestDispatch(target: EventTarget, init: WheelEventInit): WheelEvent {
  const event = inputWheelTestEventCreate(init);
  target.dispatchEvent(event);
  return event;
}

/**
 * Builds a mounted select with one option per value.
 *
 * @param values Option values in list order.
 * @returns Select element attached to the document body.
 */
export function inputWheelTestSelectCreate(values: readonly string[]): HTMLSelectElement {
  const select = document.createElement('select');
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  document.body.appendChild(select);
  return select;
}

/**
 * Builds a mounted range input.
 *
 * @param minimum Smallest value.
 * @param maximum Largest value.
 * @param step Step size.
 * @param value Starting value.
 * @returns Range input attached to the document body.
 */
export function inputWheelTestRangeCreate(
  minimum: number,
  maximum: number,
  step: number,
  value: number,
): HTMLInputElement {
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(minimum);
  range.max = String(maximum);
  range.step = String(step);
  range.value = String(value);
  document.body.appendChild(range);
  return range;
}
