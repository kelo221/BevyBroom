import { keyboardShortcutCodeFromEvent } from './keyboard_event_match.js';

/** Key codes of the Command (Meta) keys. */
const MANAGER_INPUT_META_KEY_CODES: ReadonlySet<string> = new Set(['MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);

/** Key codes of modifier keys, whose own keyup events always arrive. */
const MANAGER_INPUT_MODIFIER_KEY_CODES: ReadonlySet<string> = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'Fn',
]);

/**
 * Removes every key that is not a modifier key from a key state map.
 *
 * @param keyStates Key code to held state map, changed in place.
 */
function managerInputKeyStatesReleaseExceptModifiers(keyStates: Map<string, boolean>): void {
  for (const keyCode of [...keyStates.keys()]) {
    if (!MANAGER_INPUT_MODIFIER_KEY_CODES.has(keyCode)) {
      keyStates.delete(keyCode);
    }
  }
}

/**
 * Tracks keyboard and mouse button held state and the last known pointer client
 * position. Clears all tracked state when the owning window blurs or becomes
 * hidden. Letter and digit keys are stored under layout-stable codes. Physical
 * key positions are stored in a separate map.
 */
export class ManagerInput {
  private readonly targetWindow: Window;
  private keyStates: Map<string, boolean>;
  private physicalKeyStates: Map<string, boolean>;
  private mouseButtonStates: Map<number, boolean>;
  private keyDownListener: ((event: KeyboardEvent) => void) | null;
  private keyUpListener: ((event: KeyboardEvent) => void) | null;
  private pointerDownListener: ((event: PointerEvent) => void) | null;
  private pointerUpListener: ((event: PointerEvent) => void) | null;
  private pointerMoveListener: ((event: PointerEvent) => void) | null;
  private blurListener: (() => void) | null;
  private focusListener: (() => void) | null;
  private visibilityListener: (() => void) | null;
  private isDisposed: boolean;
  private lastPointerClientX: number;
  private lastPointerClientY: number;
  private hasLastPointerPosition: boolean;

  /**
   * Creates a new input manager and registers keyboard, pointer, and focus
   * listeners on the target window.
   *
   * @param targetWindow Window that owns the listeners.
   */
  constructor(targetWindow: Window = window) {
    this.targetWindow = targetWindow;
    this.keyStates = new Map();
    this.physicalKeyStates = new Map();
    this.mouseButtonStates = new Map();
    this.keyDownListener = null;
    this.keyUpListener = null;
    this.pointerDownListener = null;
    this.pointerUpListener = null;
    this.pointerMoveListener = null;
    this.blurListener = null;
    this.focusListener = null;
    this.visibilityListener = null;
    this.isDisposed = false;
    this.lastPointerClientX = 0;
    this.lastPointerClientY = 0;
    this.hasLastPointerPosition = false;
    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.setupFocusListeners();
  }

  /**
   * Registers window-level keyboard event listeners to track key states. They
   * listen in the capture phase so a page element that stops a key event cannot
   * hide a release.
   */
  private setupKeyboardListeners(): void {
    this.keyDownListener = (event) => {
      this.recordKeyState(event, true);
    };
    this.keyUpListener = (event) => {
      this.recordKeyState(event, false);
    };
    this.targetWindow.addEventListener('keydown', this.keyDownListener, true);
    this.targetWindow.addEventListener('keyup', this.keyUpListener, true);
  }

  /**
   * Records whether a key is currently held.
   *
   * @param event Browser keyboard event.
   * @param isDown True on keydown, false on keyup.
   */
  private recordKeyState(event: KeyboardEvent, isDown: boolean): void {
    this.commandReleaseMissedRecover(event);
    this.recordLayoutStableKeyState(event, isDown);
    this.recordPhysicalKeyState(event, isDown);
    if (!isDown && MANAGER_INPUT_META_KEY_CODES.has(event.code)) {
      this.keyStatesReleaseExceptModifiers();
    }
  }

  /**
   * Treats Command as released when an event reports it up while it is still
   * tracked as held, which happens when its keyup went to another window.
   * Letters let go meanwhile are released with it.
   *
   * @param event Keyboard or pointer event carrying the modifier flags.
   */
  private commandReleaseMissedRecover(event: KeyboardEvent | PointerEvent): void {
    if (event.metaKey || !this.isMetaDown()) {
      return;
    }
    for (const metaKeyCode of MANAGER_INPUT_META_KEY_CODES) {
      this.keyStates.delete(metaKeyCode);
      this.physicalKeyStates.delete(metaKeyCode);
    }
    this.keyStatesReleaseExceptModifiers();
  }

  /**
   * Checks whether either Command (Meta) key is tracked as held.
   *
   * @returns True while a Command key is held.
   */
  isMetaDown(): boolean {
    return [...MANAGER_INPUT_META_KEY_CODES].some((keyCode) => this.keyStates.get(keyCode) === true);
  }

  /**
   * Marks every held key except modifier keys as released. macOS sends no keyup
   * for keys let go while Command is held, so releasing Command is the last
   * moment those keys can be known to be up.
   */
  private keyStatesReleaseExceptModifiers(): void {
    managerInputKeyStatesReleaseExceptModifiers(this.keyStates);
    managerInputKeyStatesReleaseExceptModifiers(this.physicalKeyStates);
  }

  /**
   * Records the layout-stable letter or digit code for one event.
   *
   * @param event Browser keyboard event.
   * @param isDown True on keydown, false on keyup.
   */
  private recordLayoutStableKeyState(event: KeyboardEvent, isDown: boolean): void {
    this.keyStates.set(keyboardShortcutCodeFromEvent(event), isDown);
  }

  /**
   * Records the physical key position when the event includes a code.
   *
   * @param event Browser keyboard event.
   * @param isDown True on keydown, false on keyup.
   */
  private recordPhysicalKeyState(event: KeyboardEvent, isDown: boolean): void {
    if (event.code.length === 0) {
      return;
    }
    this.physicalKeyStates.set(event.code, isDown);
  }

  /**
   * Registers window-level capture-phase pointer listeners that track button
   * held state and client position.
   */
  private setupMouseListeners(): void {
    this.pointerDownListener = (event) => {
      this.commandReleaseMissedRecover(event);
      this.mouseButtonStates.set(event.button, true);
      this.recordPointerClientPosition(event.clientX, event.clientY);
    };
    this.pointerUpListener = (event) => {
      this.mouseButtonStates.set(event.button, false);
      this.recordPointerClientPosition(event.clientX, event.clientY);
    };
    this.pointerMoveListener = (event) => {
      this.recordPointerClientPosition(event.clientX, event.clientY);
    };
    this.targetWindow.addEventListener('pointerdown', this.pointerDownListener, true);
    this.targetWindow.addEventListener('pointerup', this.pointerUpListener, true);
    this.targetWindow.addEventListener('pointermove', this.pointerMoveListener, true);
  }

  /**
   * Stores the latest pointer client coordinates.
   *
   * @param clientX Viewport client X.
   * @param clientY Viewport client Y.
   */
  private recordPointerClientPosition(clientX: number, clientY: number): void {
    this.lastPointerClientX = clientX;
    this.lastPointerClientY = clientY;
    this.hasLastPointerPosition = true;
  }

  /**
   * Returns the last known pointer client position when available.
   *
   * @returns Client coordinates, or null before any pointer event.
   */
  getLastPointerClientPosition(): { clientX: number; clientY: number } | null {
    if (!this.hasLastPointerPosition) {
      return null;
    }
    return { clientX: this.lastPointerClientX, clientY: this.lastPointerClientY };
  }

  /**
   * Registers blur, focus and visibility listeners that clear all tracked input
   * state. Regaining focus clears too, because a window that lost focus without
   * a blur event never received the releases of keys let go meanwhile.
   */
  private setupFocusListeners(): void {
    this.blurListener = () => this.reset();
    this.focusListener = () => this.reset();
    this.visibilityListener = () => {
      if (this.targetWindow.document.hidden) {
        this.reset();
      }
    };
    this.targetWindow.addEventListener('blur', this.blurListener);
    this.targetWindow.addEventListener('focus', this.focusListener);
    this.targetWindow.document.addEventListener('visibilitychange', this.visibilityListener);
  }

  /**
   * Checks whether a layout-stable key code is currently held.
   *
   * @param keyCode Layout-stable key code (e.g. KeyW, KeyZ, ShiftLeft).
   * @returns True if the key is held down.
   */
  isKeyDown(keyCode: string): boolean {
    return this.keyStates.get(keyCode) === true;
  }

  /**
   * Checks whether a physical key position is currently held.
   *
   * @param keyCode Physical KeyboardEvent.code, such as KeyW or KeyS.
   * @returns True while that physical key is down.
   */
  isPhysicalKeyDown(keyCode: string): boolean {
    return this.physicalKeyStates.get(keyCode) === true;
  }

  /**
   * Checks whether a mouse button is currently pressed.
   *
   * @param button The mouse button index (0 left, 1 middle, 2 right).
   * @returns True if the button is held.
   */
  isMouseButtonDown(button: number): boolean {
    return this.mouseButtonStates.get(button) === true;
  }

  /**
   * Checks whether the right mouse button is currently pressed.
   *
   * @returns True if the right mouse button is held.
   */
  isRightMouseDown(): boolean {
    return this.isMouseButtonDown(2);
  }

  /**
   * Checks whether either Shift key is currently pressed.
   *
   * @returns True if left or right shift is held down.
   */
  isShiftDown(): boolean {
    return this.keyStates.get('ShiftLeft') === true || this.keyStates.get('ShiftRight') === true;
  }

  /**
   * Checks whether either Ctrl key is currently pressed.
   *
   * @returns True if left or right control is held down.
   */
  isCtrlDown(): boolean {
    return this.keyStates.get('ControlLeft') === true || this.keyStates.get('ControlRight') === true;
  }

  /**
   * Checks whether either Alt key is currently pressed.
   *
   * @returns True if left or right alt is held down.
   */
  isAltDown(): boolean {
    return this.keyStates.get('AltLeft') === true || this.keyStates.get('AltRight') === true;
  }

  /** Clears all tracked key and mouse button states. */
  reset(): void {
    this.keyStates.clear();
    this.physicalKeyStates.clear();
    this.mouseButtonStates.clear();
  }

  /**
   * Removes all global listeners and clears tracked input state. Safe to call
   * more than once.
   */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.removeKeyboardListeners();
    this.removeMouseListeners();
    this.removeFocusListeners();
    this.reset();
  }

  /** Unregisters keyboard window listeners. */
  private removeKeyboardListeners(): void {
    if (this.keyDownListener) {
      this.targetWindow.removeEventListener('keydown', this.keyDownListener, true);
      this.keyDownListener = null;
    }
    if (this.keyUpListener) {
      this.targetWindow.removeEventListener('keyup', this.keyUpListener, true);
      this.keyUpListener = null;
    }
  }

  /** Unregisters mouse window listeners. */
  private removeMouseListeners(): void {
    if (this.pointerDownListener) {
      this.targetWindow.removeEventListener('pointerdown', this.pointerDownListener, true);
      this.pointerDownListener = null;
    }
    if (this.pointerUpListener) {
      this.targetWindow.removeEventListener('pointerup', this.pointerUpListener, true);
      this.pointerUpListener = null;
    }
    if (this.pointerMoveListener) {
      this.targetWindow.removeEventListener('pointermove', this.pointerMoveListener, true);
      this.pointerMoveListener = null;
    }
  }

  /** Unregisters focus and visibility listeners. */
  private removeFocusListeners(): void {
    if (this.blurListener) {
      this.targetWindow.removeEventListener('blur', this.blurListener);
      this.blurListener = null;
    }
    if (this.focusListener) {
      this.targetWindow.removeEventListener('focus', this.focusListener);
      this.focusListener = null;
    }
    if (this.visibilityListener) {
      this.targetWindow.document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }
}
