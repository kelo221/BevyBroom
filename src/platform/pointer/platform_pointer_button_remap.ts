import type { PlatformPointerButtonRemapRule } from '@/platform/pointer/platform_pointer_button_remap_rule.js';
import { PLATFORM_POINTER_BUTTON_PRIMARY } from '@/platform/pointer/platform_pointer_button_map.js';
import {
  platformPointerButtonsRemap,
  platformPointerEventCloneWithButton,
  platformPointerMouseEventCreate,
} from '@/platform/pointer/platform_pointer_event_clone.js';

/** Pointer event types the remap watches on a window. */
const PLATFORM_POINTER_REMAP_EVENT_TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;

/** Mouse event type delivered alongside a remapped press or release. */
const PLATFORM_POINTER_REMAP_MOUSE_EVENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  pointerdown: 'mousedown',
  pointerup: 'mouseup',
});

/** Primary button press that is being delivered as another button. */
interface PlatformPointerRemappedPress {
  readonly pointerId: number;
  readonly button: number;
}

/**
 * Delivers primary button presses that a rule claims as another mouse button:
 * the browser's press, moves and release are stopped before any page listener
 * sees them and copies reporting the other button are dispatched on the same
 * target, so every pointer consumer sees one consistent press.
 */
export class PlatformPointerButtonRemap {
  private readonly rules: readonly PlatformPointerButtonRemapRule[];
  private readonly listener: (event: Event) => void;
  private readonly windows = new Set<Window>();
  private readonly dispatchedCopies = new WeakSet<Event>();
  private remappedPress: PlatformPointerRemappedPress | null = null;

  /**
   * Creates the remap without listening yet.
   *
   * @param rules Rules asked in order whether a press acts as another button.
   */
  constructor(rules: readonly PlatformPointerButtonRemapRule[]) {
    this.rules = rules;
    this.listener = (event) => this.eventHandle(event);
  }

  /**
   * Starts remapping presses made in a window. Safe to call repeatedly for the
   * same window.
   *
   * @param targetWindow Window whose presses are remapped.
   */
  installOnWindow(targetWindow: Window): void {
    if (this.windows.has(targetWindow)) {
      return;
    }
    this.windows.add(targetWindow);
    for (const type of PLATFORM_POINTER_REMAP_EVENT_TYPES) {
      targetWindow.addEventListener(type, this.listener, { capture: true });
    }
  }

  /**
   * Stops remapping presses made in a window.
   *
   * @param targetWindow Window that no longer remaps presses.
   */
  uninstallFromWindow(targetWindow: Window): void {
    if (!this.windows.delete(targetWindow)) {
      return;
    }
    for (const type of PLATFORM_POINTER_REMAP_EVENT_TYPES) {
      targetWindow.removeEventListener(type, this.listener, { capture: true });
    }
  }

  /** Stops remapping in every window. */
  dispose(): void {
    for (const targetWindow of [...this.windows]) {
      this.uninstallFromWindow(targetWindow);
    }
    this.remappedPress = null;
  }

  /**
   * Returns the button the held primary press is delivered as.
   *
   * @returns Button index, or null while no press is remapped.
   */
  remappedButtonRead(): number | null {
    return this.remappedPress?.button ?? null;
  }

  /**
   * Routes one pointer event: a press claimed by a rule starts a remapped
   * press, later events of that pointer are rewritten until it is released.
   *
   * @param event Pointer event seen first on the window.
   */
  private eventHandle(event: Event): void {
    if (this.dispatchedCopies.has(event) || !(event instanceof PointerEvent)) {
      return;
    }
    if (event.type === 'pointerdown') {
      this.pressHandle(event);
      return;
    }
    if (this.remappedPress === null || this.remappedPress.pointerId !== event.pointerId) {
      return;
    }
    this.heldEventHandle(event);
  }

  /**
   * Starts a remapped press when a rule claims the press.
   *
   * @param event Pointer down event.
   */
  private pressHandle(event: PointerEvent): void {
    const button = this.pressButtonResolve(event);
    if (button === null) {
      return;
    }
    this.remappedPress = { pointerId: event.pointerId, button };
    this.replaceWithCopy(event, button);
  }

  /**
   * Asks the rules in order which button a press acts as.
   *
   * @param event Pointer down event.
   * @returns Button index, or null when no rule claims the press.
   */
  private pressButtonResolve(event: PointerEvent): number | null {
    for (const rule of this.rules) {
      const button = rule.pressButtonResolve(event);
      if (button !== null) {
        return button;
      }
    }
    return null;
  }

  /**
   * Rewrites a move, release or cancel of the remapped pointer and ends the
   * remapped press on release or cancel.
   *
   * @param event Pointer event of the remapped pointer.
   */
  private heldEventHandle(event: PointerEvent): void {
    const button = this.remappedPress?.button ?? 0;
    if (event.type === 'pointercancel') {
      this.remappedPress = null;
      return;
    }
    if (event.type === 'pointerup') {
      this.remappedPress = null;
    }
    this.replaceWithCopy(event, button);
  }

  /**
   * Stops the browser's event and dispatches copies reporting the other button
   * on its target: the pointer event and, for presses and releases, the
   * matching mouse event the browser no longer sends. Moves keep their button
   * of -1 and only have their held buttons rewritten.
   *
   * @param event Browser pointer event.
   * @param button Button index the primary button is delivered as.
   */
  private replaceWithCopy(event: PointerEvent, button: number): void {
    event.stopImmediatePropagation();
    event.preventDefault();
    const target = event.target;
    if (target === null) {
      return;
    }
    const copyButton = event.button === PLATFORM_POINTER_BUTTON_PRIMARY ? button : event.button;
    const buttons = platformPointerButtonsRemap(event.buttons, button);
    this.copyDispatch(target, platformPointerEventCloneWithButton(event, copyButton, buttons));
    const mouseEventType = PLATFORM_POINTER_REMAP_MOUSE_EVENT_TYPES[event.type];
    if (mouseEventType !== undefined) {
      this.copyDispatch(target, platformPointerMouseEventCreate(event, mouseEventType, copyButton, buttons));
    }
  }

  /**
   * Dispatches a copy and remembers it so the window listener lets it through.
   *
   * @param target Element the copy is dispatched on.
   * @param copy Event copy.
   */
  private copyDispatch(target: EventTarget, copy: Event): void {
    this.dispatchedCopies.add(copy);
    target.dispatchEvent(copy);
  }
}
