/** Hand-driven clock for render demand tests. */
export class RenderDemandTestClock {
  private currentMs: number;

  /**
   * Creates the clock at the given time.
   *
   * @param startMs Starting time in milliseconds.
   */
  constructor(startMs: number) {
    this.currentMs = startMs;
  }

  /**
   * Returns the current time.
   *
   * @returns Milliseconds.
   */
  readonly nowMs = (): number => this.currentMs;

  /**
   * Moves the clock forward.
   *
   * @param elapsedMs Milliseconds to add.
   */
  advance(elapsedMs: number): void {
    this.currentMs += elapsedMs;
  }
}

/**
 * Creates a stand-in window that only dispatches events.
 *
 * @returns Event target typed as a window.
 */
export function renderDemandTestWindowCreate(): Window {
  return new EventTarget() as unknown as Window;
}

/**
 * Dispatches a pointer event with the given pointer id on a window.
 *
 * @param target Window receiving the event.
 * @param type Pointer event name such as pointerdown.
 * @param pointerId Pointer id carried by the event.
 */
export function renderDemandTestPointerDispatch(target: Window, type: string, pointerId: number): void {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
}

/**
 * Dispatches a keyboard event with the given key code on a window.
 *
 * @param target Window receiving the event.
 * @param type Keyboard event name such as keydown.
 * @param code Physical key code carried by the event.
 */
export function renderDemandTestKeyDispatch(target: Window, type: string, code: string): void {
  const event = new Event(type);
  Object.defineProperty(event, 'code', { value: code });
  target.dispatchEvent(event);
}
