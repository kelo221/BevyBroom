/** Keyboard codes of the two Alt keys. */
const GUARD_VIEWPORT_WHEEL_ALT_CODES: readonly string[] = ['AltLeft', 'AltRight'];

/** Listeners the guard holds on one armed window. */
interface GuardViewportWheelAltReleaseListeners {
  /** Capture keyup listener waiting for the Alt release. */
  readonly keyRelease: (event: KeyboardEvent) => void;
  /** Blur and visibility listener that gives up waiting. */
  readonly focusLoss: () => void;
}

/**
 * Keeps the release of Alt after an Alt+wheel gesture from reaching the browser
 * or the window, where a lone Alt release would focus a menu bar. It stops
 * waiting when the window loses focus or visibility.
 */
export class GuardViewportWheelAltRelease {
  private readonly armedWindows: Map<Window, GuardViewportWheelAltReleaseListeners>;

  /** Creates a guard that watches no window yet. */
  constructor() {
    this.armedWindows = new Map();
  }

  /**
   * Returns the window a wheel event happened in: the window of the element it
   * was dispatched to, else the event's view.
   *
   * @param event Wheel event.
   * @returns Window of the event, or null when it has none.
   */
  static eventWindowRead(event: WheelEvent): Window | null {
    const targetNode = event.target as Partial<Node> | null;
    return targetNode?.ownerDocument?.defaultView ?? event.view;
  }

  /**
   * Returns whether a key event releases an Alt key.
   *
   * @param event Key event.
   * @returns True for either Alt key.
   */
  private static altReleaseIs(event: KeyboardEvent): boolean {
    return event.key === 'Alt' || GUARD_VIEWPORT_WHEEL_ALT_CODES.includes(event.code);
  }

  /**
   * Arms the guard for a window when a wheel turn was taken while Alt was held,
   * so the next Alt release in that window has its default prevented.
   *
   * @param event Wheel event a viewport tool consumed.
   * @param targetWindow Window the event happened in, or null.
   */
  arm(event: WheelEvent, targetWindow: Window | null): void {
    if (!event.altKey || !targetWindow || this.armedWindows.has(targetWindow)) {
      return;
    }
    const listeners = this.listenersCreate(targetWindow);
    this.armedWindows.set(targetWindow, listeners);
    targetWindow.addEventListener('keyup', listeners.keyRelease, true);
    targetWindow.addEventListener('blur', listeners.focusLoss);
    targetWindow.document.addEventListener('visibilitychange', listeners.focusLoss);
  }

  /**
   * Stops waiting for an Alt release in a window and removes its listeners.
   *
   * @param targetWindow Window to disarm.
   */
  disarm(targetWindow: Window): void {
    const listeners = this.armedWindows.get(targetWindow);
    if (!listeners) {
      return;
    }
    this.armedWindows.delete(targetWindow);
    targetWindow.removeEventListener('keyup', listeners.keyRelease, true);
    targetWindow.removeEventListener('blur', listeners.focusLoss);
    targetWindow.document.removeEventListener('visibilitychange', listeners.focusLoss);
  }

  /** Stops waiting in every window and removes all listeners. */
  disarmAll(): void {
    [...this.armedWindows.keys()].forEach((targetWindow) => this.disarm(targetWindow));
  }

  /**
   * Builds the listeners bound to one window.
   *
   * @param targetWindow Window the listeners belong to.
   * @returns Key release and focus loss listeners.
   */
  private listenersCreate(targetWindow: Window): GuardViewportWheelAltReleaseListeners {
    return {
      keyRelease: (event) => this.keyReleaseHandle(targetWindow, event),
      focusLoss: () => this.disarm(targetWindow),
    };
  }

  /**
   * Prevents the default of an Alt release in an armed window and disarms it.
   *
   * @param targetWindow Window the release happened in.
   * @param event Key release event.
   */
  private keyReleaseHandle(targetWindow: Window, event: KeyboardEvent): void {
    if (!GuardViewportWheelAltRelease.altReleaseIs(event)) {
      return;
    }
    event.preventDefault();
    this.disarm(targetWindow);
  }
}
