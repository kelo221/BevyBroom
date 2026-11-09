import { GuardViewportWheelAltRelease } from './guard_viewport_wheel_alt_release.js';

/**
 * Offered every wheel event over a 2D or 3D viewport before the camera zooms or
 * dollies.
 *
 * @param event Wheel event over the viewport.
 * @returns True when the consumer used the event, which stops the camera from
 *   handling it.
 */
export type ViewportWheelConsumer = (event: WheelEvent) => boolean;

/**
 * Tools that take viewport wheel turns before camera navigation does, for
 * example a brush tool resizing its radius on a modifier+wheel turn.
 */
export class RegistryViewportWheelConsumer {
  private readonly consumers: Set<ViewportWheelConsumer>;
  private readonly altReleaseGuard: GuardViewportWheelAltRelease;

  /** Creates an empty registry. */
  constructor() {
    this.consumers = new Set();
    this.altReleaseGuard = new GuardViewportWheelAltRelease();
  }

  /**
   * Adds a consumer that is offered every viewport wheel event.
   *
   * @param consumer Consumer to add.
   * @returns Function that removes the consumer again and stops waiting for
   *   pending Alt releases.
   */
  consumerAdd(consumer: ViewportWheelConsumer): () => void {
    this.consumers.add(consumer);
    return () => {
      this.consumers.delete(consumer);
      this.altReleaseGuard.disarmAll();
    };
  }

  /**
   * Offers a viewport wheel event to the consumers in the order they were
   * added. A consumed event has its default prevented and, when Alt was held,
   * the following Alt release is kept from the browser.
   *
   * @param event Wheel event over a viewport.
   * @returns True when a consumer used the event.
   */
  eventOffer(event: WheelEvent): boolean {
    for (const consumer of this.consumers) {
      if (consumer(event)) {
        event.preventDefault();
        this.altReleaseGuard.arm(event, GuardViewportWheelAltRelease.eventWindowRead(event));
        return true;
      }
    }
    return false;
  }
}

let sharedViewportWheelConsumerRegistry: RegistryViewportWheelConsumer | null = null;

/**
 * Returns the shared viewport wheel consumer registry.
 *
 * @returns Shared RegistryViewportWheelConsumer.
 */
export function getRegistryViewportWheelConsumer(): RegistryViewportWheelConsumer {
  if (!sharedViewportWheelConsumerRegistry) {
    sharedViewportWheelConsumerRegistry = new RegistryViewportWheelConsumer();
  }
  return sharedViewportWheelConsumerRegistry;
}
