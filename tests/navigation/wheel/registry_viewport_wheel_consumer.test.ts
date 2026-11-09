import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RegistryViewportWheelConsumer,
  getRegistryViewportWheelConsumer,
} from '@/navigation/wheel/registry_viewport_wheel_consumer.js';

/** Removers of consumers added to the shared registry by the running test. */
const sharedConsumerRemovers: Array<() => void> = [];

/**
 * Builds a cancelable wheel event.
 *
 * @param altKey Whether Alt is held.
 * @returns Wheel event that scrolls away from the user.
 */
function wheelEventCreate(altKey: boolean): WheelEvent {
  return new WheelEvent('wheel', { deltaY: -1, altKey, cancelable: true });
}

/**
 * Dispatches a wheel event on an element of the document whose wheel listener
 * offers it to the shared registry.
 *
 * @param event Wheel event to dispatch.
 */
function wheelEventDispatchToSharedRegistry(event: WheelEvent): void {
  const element = document.createElement('div');
  element.addEventListener('wheel', (wheelEvent) => getRegistryViewportWheelConsumer().eventOffer(wheelEvent));
  element.dispatchEvent(event);
}

afterEach(() => {
  sharedConsumerRemovers.splice(0).forEach((remove) => remove());
});

/** Tools taking viewport wheel turns before camera navigation. */
describe('RegistryViewportWheelConsumer', () => {
  it('reports an unconsumed event without preventing its default', () => {
    const registry = new RegistryViewportWheelConsumer();
    const decliningConsumer = vi.fn(() => false);
    registry.consumerAdd(decliningConsumer);
    const event = wheelEventCreate(false);
    expect(registry.eventOffer(event)).toBe(false);
    expect(decliningConsumer).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops at the first consumer that takes the event and prevents its default', () => {
    const registry = new RegistryViewportWheelConsumer();
    const takingConsumer = vi.fn(() => true);
    const laterConsumer = vi.fn(() => true);
    registry.consumerAdd(takingConsumer);
    registry.consumerAdd(laterConsumer);
    const event = wheelEventCreate(false);
    expect(registry.eventOffer(event)).toBe(true);
    expect(takingConsumer).toHaveBeenCalledOnce();
    expect(laterConsumer).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('stops offering events to a removed consumer', () => {
    const registry = new RegistryViewportWheelConsumer();
    const takingConsumer = vi.fn(() => true);
    const remove = registry.consumerAdd(takingConsumer);
    remove();
    expect(registry.eventOffer(wheelEventCreate(false))).toBe(false);
    expect(takingConsumer).not.toHaveBeenCalled();
  });

  it('keeps the Alt release after a consumed Alt+wheel turn from the browser once', () => {
    sharedConsumerRemovers.push(getRegistryViewportWheelConsumer().consumerAdd(() => true));
    wheelEventDispatchToSharedRegistry(wheelEventCreate(true));
    const firstAltRelease = new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft', cancelable: true });
    window.dispatchEvent(firstAltRelease);
    const secondAltRelease = new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft', cancelable: true });
    window.dispatchEvent(secondAltRelease);
    expect(firstAltRelease.defaultPrevented).toBe(true);
    expect(secondAltRelease.defaultPrevented).toBe(false);
  });

  it('stops waiting for the Alt release once the consumer is removed', () => {
    const removeConsumer = getRegistryViewportWheelConsumer().consumerAdd(() => true);
    wheelEventDispatchToSharedRegistry(wheelEventCreate(true));
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    removeConsumer();
    const removedKeyupListeners = removeListenerSpy.mock.calls.filter(([type]) => type === 'keyup').length;
    removeListenerSpy.mockRestore();
    const altRelease = new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft', cancelable: true });
    window.dispatchEvent(altRelease);
    expect(removedKeyupListeners).toBe(1);
    expect(altRelease.defaultPrevented).toBe(false);
  });
});
