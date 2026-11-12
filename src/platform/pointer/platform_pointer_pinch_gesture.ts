/**
 * WebKit gesture event: the trackpad pinch WebKit reports instead of a wheel
 * event.
 */
interface PlatformPointerGestureEvent extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Receives one pinch step.
 *
 * @param scaleRatio Scale of the previous step divided by the scale of this
 *   step; below 1 while the fingers spread (zoom in).
 * @param clientX Horizontal pointer position in client pixels.
 * @param clientY Vertical pointer position in client pixels.
 */
export type PlatformPointerPinchListener = (scaleRatio: number, clientX: number, clientY: number) => void;

/** Gesture event types WebKit fires for a trackpad pinch. */
const PLATFORM_POINTER_PINCH_EVENT_TYPES = ['gesturestart', 'gesturechange', 'gestureend'] as const;

/**
 * Listens for the WebKit trackpad pinch over an element and reports each step
 * as a scale ratio, so views zoom in WebKit based shells as they do where the
 * pinch arrives as a wheel event.
 */
export class PlatformPointerPinchGesture {
  private readonly element: HTMLElement;
  private readonly listener: PlatformPointerPinchListener;
  private readonly eventListener: (event: Event) => void;
  private previousScale = 1;

  /**
   * Starts listening on an element.
   *
   * @param element Element whose pinches are reported.
   * @param listener Receives each pinch step.
   */
  constructor(element: HTMLElement, listener: PlatformPointerPinchListener) {
    this.element = element;
    this.listener = listener;
    this.eventListener = (event) => this.gestureHandle(event as PlatformPointerGestureEvent);
    for (const type of PLATFORM_POINTER_PINCH_EVENT_TYPES) {
      element.addEventListener(type, this.eventListener, { passive: false });
    }
  }

  /** Stops listening. */
  dispose(): void {
    for (const type of PLATFORM_POINTER_PINCH_EVENT_TYPES) {
      this.element.removeEventListener(type, this.eventListener);
    }
  }

  /**
   * Keeps the page from zooming on the pinch and reports the scale change of a
   * step relative to the previous one.
   *
   * @param event WebKit gesture event.
   */
  private gestureHandle(event: PlatformPointerGestureEvent): void {
    event.preventDefault();
    const scale = Number.isFinite(event.scale) && event.scale > 0 ? event.scale : 1;
    if (event.type === 'gesturestart') {
      this.previousScale = scale;
      return;
    }
    if (event.type === 'gesturechange') {
      this.listener(this.previousScale / scale, event.clientX, event.clientY);
    }
    this.previousScale = event.type === 'gestureend' ? 1 : scale;
  }
}
