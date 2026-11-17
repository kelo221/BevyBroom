/**
 * Pointer travel in CSS pixels off the tab strip before a tab floats its
 * window.
 */
export const DOCK_ZONE_TAB_DRAG_OUT_THRESHOLD_PX = 16;

/**
 * Follows presses on the tabs of a dock zone and floats a tab's window once the
 * pointer leaves the tab strip by more than a threshold.
 */
export class DockZoneTabDrag {
  private readonly strip: HTMLElement;
  private readonly windowFloat: (windowId: string, event: PointerEvent) => void;
  private abortController: AbortController | null = null;

  /**
   * Creates the tab drag of one dock zone.
   *
   * @param strip Tab strip of the zone.
   * @param windowFloat Floats a window, continuing the drag from a pointer
   *   event.
   */
  constructor(strip: HTMLElement, windowFloat: (windowId: string, event: PointerEvent) => void) {
    this.strip = strip;
    this.windowFloat = windowFloat;
  }

  /**
   * Starts following a primary press on a tab.
   *
   * @param windowId Window of the pressed tab.
   * @param event Pointer press.
   */
  pressHandle(windowId: string, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.stop();
    const abortController = new AbortController();
    this.abortController = abortController;
    const ownerDocument = this.strip.ownerDocument;
    const options = { signal: abortController.signal, capture: true };
    ownerDocument.addEventListener('pointermove', (moveEvent) => this.pointerMoved(windowId, moveEvent), options);
    ownerDocument.addEventListener('pointerup', () => this.stop(), options);
    ownerDocument.addEventListener('pointercancel', () => this.stop(), options);
  }

  /**
   * Floats the window once the pointer is far enough off the strip.
   *
   * @param windowId Window of the pressed tab.
   * @param event Pointer move.
   */
  private pointerMoved(windowId: string, event: PointerEvent): void {
    if (!this.isOffStrip(event.clientX, event.clientY)) {
      return;
    }
    this.stop();
    this.windowFloat(windowId, event);
  }

  /**
   * Returns whether a client point lies beyond the threshold around the strip.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns True off the strip.
   */
  private isOffStrip(clientX: number, clientY: number): boolean {
    const rect = this.strip.getBoundingClientRect();
    const margin = DOCK_ZONE_TAB_DRAG_OUT_THRESHOLD_PX;
    const isInsideX = clientX >= rect.left - margin && clientX <= rect.right + margin;
    const isInsideY = clientY >= rect.top - margin && clientY <= rect.bottom + margin;
    return !(isInsideX && isInsideY);
  }

  /** Stops following the press. */
  private stop(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}
