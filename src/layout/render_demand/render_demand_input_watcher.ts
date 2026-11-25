/** Window events that mean the user is interacting with the editor right now. */
const RENDER_DEMAND_INPUT_EVENT_NAMES: readonly string[] = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'wheel',
  'keydown',
  'keyup',
  'contextmenu',
  'dragover',
  'drop',
];

/**
 * Window events that may change what the viewports show without any input
 * event.
 */
const RENDER_DEMAND_WAKE_EVENT_NAMES: readonly string[] = ['focus', 'blur', 'resize'];

/**
 * Watches one window for user input and reports when it last happened and
 * whether a pointer button or a key is still held down.
 */
export class RenderDemandInputWatcher {
  private readonly watchedWindow: Window;
  private readonly nowMs: () => number;
  private readonly heldPointerIds: Set<number>;
  private readonly heldKeyCodes: Set<string>;
  private lastInputAtMs: number;
  private readonly boundInputHandle: (event: Event) => void;
  private readonly boundWakeHandle: (event: Event) => void;

  /**
   * Creates the watcher and starts listening on the given window.
   *
   * @param watchedWindow Window whose input events are watched.
   * @param nowMs Clock returning the current time in milliseconds.
   */
  constructor(watchedWindow: Window, nowMs: () => number) {
    this.watchedWindow = watchedWindow;
    this.nowMs = nowMs;
    this.heldPointerIds = new Set();
    this.heldKeyCodes = new Set();
    this.lastInputAtMs = nowMs();
    this.boundInputHandle = (event: Event) => this.inputHandle(event);
    this.boundWakeHandle = (event: Event) => this.wakeHandle(event);
    this.listenersAdd();
  }

  /**
   * Returns the time of the most recent input or wake event.
   *
   * @returns Milliseconds on the watcher's clock.
   */
  lastInputAtMsRead(): number {
    return this.lastInputAtMs;
  }

  /**
   * Returns whether any pointer button or keyboard key is currently held down.
   *
   * @returns True while something is held.
   */
  isAnythingHeld(): boolean {
    return this.heldPointerIds.size > 0 || this.heldKeyCodes.size > 0;
  }

  /** Stops listening and forgets every held pointer and key. */
  dispose(): void {
    RENDER_DEMAND_INPUT_EVENT_NAMES.forEach((name) =>
      this.watchedWindow.removeEventListener(name, this.boundInputHandle, true),
    );
    RENDER_DEMAND_WAKE_EVENT_NAMES.forEach((name) =>
      this.watchedWindow.removeEventListener(name, this.boundWakeHandle, true),
    );
    this.heldStateClear();
  }

  /** Adds capture-phase passive listeners for every watched event. */
  private listenersAdd(): void {
    const options: AddEventListenerOptions = { capture: true, passive: true };
    RENDER_DEMAND_INPUT_EVENT_NAMES.forEach((name) =>
      this.watchedWindow.addEventListener(name, this.boundInputHandle, options),
    );
    RENDER_DEMAND_WAKE_EVENT_NAMES.forEach((name) =>
      this.watchedWindow.addEventListener(name, this.boundWakeHandle, options),
    );
  }

  /**
   * Records an input event and updates the held pointer and key sets.
   *
   * @param event Input event seen on the window.
   */
  private inputHandle(event: Event): void {
    this.lastInputAtMsMark();
    this.heldPointerUpdate(event);
    this.heldKeyUpdate(event);
  }

  /**
   * Records a wake event; losing focus also forgets held input, whose release
   * the window will never see.
   *
   * @param event Wake event seen on the window.
   */
  private wakeHandle(event: Event): void {
    this.lastInputAtMsMark();
    if (event.type === 'blur') {
      this.heldStateClear();
    }
  }

  /**
   * Adds a pointer to the held set on press and removes it on release or
   * cancel.
   *
   * @param event Input event seen on the window.
   */
  private heldPointerUpdate(event: Event): void {
    const pointerId = (event as PointerEvent).pointerId;
    if (typeof pointerId !== 'number') {
      return;
    }
    if (event.type === 'pointerdown') {
      this.heldPointerIds.add(pointerId);
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      this.heldPointerIds.delete(pointerId);
    }
  }

  /**
   * Adds a key to the held set on key down and removes it on key up.
   *
   * @param event Input event seen on the window.
   */
  private heldKeyUpdate(event: Event): void {
    const keyCode = (event as KeyboardEvent).code;
    if (typeof keyCode !== 'string') {
      return;
    }
    if (event.type === 'keydown') {
      this.heldKeyCodes.add(keyCode);
    } else if (event.type === 'keyup') {
      this.heldKeyCodes.delete(keyCode);
    }
  }

  /** Records the current time as the time of the latest input. */
  private lastInputAtMsMark(): void {
    this.lastInputAtMs = this.nowMs();
  }

  /** Forgets every held pointer and key. */
  private heldStateClear(): void {
    this.heldPointerIds.clear();
    this.heldKeyCodes.clear();
  }
}
