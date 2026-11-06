import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputNumberSpinner } from '@/ui/input/input_number_spinner.js';

/** Spinners built by the running test. */
const spinnerTestInstances: InputNumberSpinner[] = [];

/**
 * Builds a mounted spinner with the given step and a commit spy.
 *
 * @param step Step size of the spinner.
 * @returns Spinner and the spy called on every commit.
 */
function spinnerTestCreate(step: number): { spinner: InputNumberSpinner; onCommit: ReturnType<typeof vi.fn> } {
  const spinner = new InputNumberSpinner({ step, decimals: 2, ariaLabel: 'Test value' });
  const onCommit = vi.fn();
  spinner.bindCommit(onCommit);
  document.body.appendChild(spinner.spinnerElementRead());
  spinnerTestInstances.push(spinner);
  return { spinner, onCommit };
}

/**
 * Finds one stepper button of a spinner.
 *
 * @param spinner Spinner to search.
 * @param direction Which stepper to find.
 * @returns Stepper button.
 */
function stepperButtonRead(spinner: InputNumberSpinner, direction: 'up' | 'down'): HTMLButtonElement {
  const button = spinner.spinnerElementRead().querySelector<HTMLButtonElement>(`.input-number-spinner-${direction}`);
  if (!button) {
    throw new Error(`stepper not found: ${direction}`);
  }
  return button;
}

/**
 * Builds a bubbling, cancelable wheel event.
 *
 * @param init Wheel deltas and modifier keys.
 * @returns Wheel event.
 */
function wheelEventCreate(init: WheelEventInit): WheelEvent {
  return new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
}

afterEach(() => {
  spinnerTestInstances.splice(0).forEach((spinner) => spinner.dispose());
  document.body.replaceChildren();
});

describe('InputNumberSpinner', () => {
  it('holds the numeric field and both steppers in its root', () => {
    const { spinner } = spinnerTestCreate(1);
    const root = spinner.spinnerElementRead();
    expect(root.contains(spinner.getElement())).toBe(true);
    expect(stepperButtonRead(spinner, 'up').getAttribute('aria-label')).toContain('Test value');
    expect(stepperButtonRead(spinner, 'down').getAttribute('aria-label')).toContain('Test value');
  });

  it('steps up and down by its step size and commits each step', () => {
    const step = 0.25;
    const start = 1.5;
    const { spinner, onCommit } = spinnerTestCreate(step);
    spinner.setNumber(start, 2);
    stepperButtonRead(spinner, 'up').click();
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start + step, 6);
    stepperButtonRead(spinner, 'down').click();
    stepperButtonRead(spinner, 'down').click();
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start - step, 6);
    expect(onCommit).toHaveBeenCalledTimes(3);
  });

  it('does not drift after many fractional steps', () => {
    const step = 0.1;
    const stepCount = 30;
    const { spinner } = spinnerTestCreate(step);
    spinner.setNumber(0, 2);
    for (let index = 0; index < stepCount; index++) {
      spinner.stepBy(1);
    }
    expect(spinner.getText()).not.toMatch(/0000|9999/);
    expect(spinner.parseNumberOrNull()).toBeCloseTo(step * stepCount, 6);
  });

  it('steps with the arrow keys typed in the field', () => {
    const step = 2;
    const { spinner, onCommit } = spinnerTestCreate(step);
    spinner.setNumber(10, 0);
    spinner.getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(spinner.parseNumberOrNull()).toBe(10 + step);
    spinner.getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(spinner.parseNumberOrNull()).toBe(10);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('leaves a mixed value alone and does not commit', () => {
    const { spinner, onCommit } = spinnerTestCreate(1);
    spinner.setNumber(null, 2);
    expect(spinner.stepBy(1)).toBe(false);
    stepperButtonRead(spinner, 'up').click();
    expect(spinner.parseNumberOrNull()).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('steps with the mouse wheel over the spinner, commits and blocks the page scroll', () => {
    const step = 0.5;
    const start = 4;
    const { spinner, onCommit } = spinnerTestCreate(step);
    spinner.setNumber(start, 2);
    const scrollUp = wheelEventCreate({ deltaY: -120 });
    spinner.getElement().dispatchEvent(scrollUp);
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start + step, 6);
    expect(scrollUp.defaultPrevented).toBe(true);
    stepperButtonRead(spinner, 'down').dispatchEvent(wheelEventCreate({ deltaY: 120 }));
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start, 6);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('steps ten times with Shift and a tenth with Ctrl on the wheel', () => {
    const step = 1;
    const start = 20;
    const { spinner } = spinnerTestCreate(step);
    spinner.setNumber(start, 2);
    spinner.getElement().dispatchEvent(wheelEventCreate({ deltaY: -100, shiftKey: true }));
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start + 10 * step, 6);
    spinner.getElement().dispatchEvent(wheelEventCreate({ deltaX: 100, shiftKey: true }));
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start, 6);
    spinner.getElement().dispatchEvent(wheelEventCreate({ deltaY: -100, ctrlKey: true }));
    expect(spinner.parseNumberOrNull()).toBeCloseTo(start + 0.1 * step, 6);
  });

  it('lets the page scroll over a mixed value or after dispose', () => {
    const { spinner, onCommit } = spinnerTestCreate(1);
    spinner.setNumber(null, 2);
    const overMixed = wheelEventCreate({ deltaY: -100 });
    spinner.getElement().dispatchEvent(overMixed);
    expect(overMixed.defaultPrevented).toBe(false);
    spinner.setNumber(3, 0);
    spinner.dispose();
    const afterDispose = wheelEventCreate({ deltaY: -100 });
    spinner.getElement().dispatchEvent(afterDispose);
    expect(afterDispose.defaultPrevented).toBe(false);
    expect(spinner.parseNumberOrNull()).toBe(3);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('stops stepping on arrow keys after dispose', () => {
    const { spinner, onCommit } = spinnerTestCreate(1);
    spinner.setNumber(3, 0);
    spinner.dispose();
    spinner.getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(spinner.parseNumberOrNull()).toBe(3);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
