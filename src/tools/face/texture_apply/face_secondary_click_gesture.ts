import { WindowPointerDragSession } from '@/utils/session_window_pointer_drag.js';

/** Pointer travel in pixels below which a right-button press counts as a click. */
export const FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX = 4;

/** Mouse button index of the secondary (right) button. */
const FACE_SECONDARY_CLICK_BUTTON = 2;

/**
 * Receives a completed right-button click.
 *
 * @param isAltHeld True when Alt was held at release.
 */
export type FaceSecondaryClickHandler = (isAltHeld: boolean) => void;

/**
 * Receives the first move that exceeds the click travel threshold.
 *
 * @param event Move that crossed the threshold.
 */
export type FaceSecondaryDragHandler = (event: PointerEvent) => void;

/**
 * Tells a right-button click from a right-button drag. A press arms the
 * gesture; the release fires the click handler only when the pointer travelled
 * less than {@link FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX}, counting both client
 * movement and the relative movement reported under pointer lock. While armed,
 * the browser context menu of the owner window is suppressed.
 */
export class FaceSecondaryClickGesture {
  private readonly dragSession: WindowPointerDragSession;
  private readonly contextMenuSuppressListener: (event: Event) => void;
  private contextMenuWindow: Window | null;
  private pressClientX: number;
  private pressClientY: number;
  private relativeTravelPx: number;
  private furthestClientTravelPx: number;
  private clickHandler: FaceSecondaryClickHandler | null;
  private dragHandler: FaceSecondaryDragHandler | null;

  /** Creates an idle gesture. */
  constructor() {
    this.dragSession = new WindowPointerDragSession();
    this.contextMenuSuppressListener = (event) => event.preventDefault();
    this.contextMenuWindow = null;
    this.pressClientX = 0;
    this.pressClientY = 0;
    this.relativeTravelPx = 0;
    this.furthestClientTravelPx = 0;
    this.clickHandler = null;
    this.dragHandler = null;
  }

  /**
   * Arms the gesture at a right-button press.
   *
   * @param ownerWindow Window that owns the press.
   * @param clientX Press client X.
   * @param clientY Press client Y.
   * @param clickHandler Runs when the release completes a click.
   * @param dragHandler Runs once when travel first exceeds the click threshold.
   */
  begin(
    ownerWindow: Window,
    clientX: number,
    clientY: number,
    clickHandler: FaceSecondaryClickHandler,
    dragHandler: FaceSecondaryDragHandler | null = null,
  ): void {
    this.cancel();
    this.travelReset(clientX, clientY);
    this.clickHandler = clickHandler;
    this.dragHandler = dragHandler;
    this.contextMenuSuppressInstall(ownerWindow);
    this.dragSession.begin(
      (event) => this.travelRecord(event),
      (releaseEvent) => this.releaseFinish(releaseEvent),
      ownerWindow,
    );
  }

  /**
   * Returns whether a press is armed and waiting for its release.
   *
   * @returns True while armed.
   */
  isArmed(): boolean {
    return this.dragSession.isActive();
  }

  /** Disarms the gesture without firing the click or drag handler. */
  cancel(): void {
    this.clickHandler = null;
    this.dragHandler = null;
    this.dragSession.end();
    this.contextMenuSuppressRemove();
  }

  /**
   * Resets the travel counters at a new press point.
   *
   * @param clientX Press client X.
   * @param clientY Press client Y.
   */
  private travelReset(clientX: number, clientY: number): void {
    this.pressClientX = clientX;
    this.pressClientY = clientY;
    this.relativeTravelPx = 0;
    this.furthestClientTravelPx = 0;
  }

  /**
   * Adds one pointer move sample to the travel counters.
   *
   * @param event Window pointer move event.
   */
  private travelRecord(event: PointerEvent): void {
    this.relativeTravelPx += Math.hypot(event.movementX || 0, event.movementY || 0);
    const clientTravel = Math.hypot(event.clientX - this.pressClientX, event.clientY - this.pressClientY);
    this.furthestClientTravelPx = Math.max(this.furthestClientTravelPx, clientTravel);
    this.dragThresholdNotify(event);
  }

  /**
   * Fires the drag handler once when travel first exceeds the click threshold.
   *
   * @param event Move that may have crossed the threshold.
   */
  private dragThresholdNotify(event: PointerEvent): void {
    if (this.travelIsClick() || this.dragHandler === null) {
      return;
    }
    const handler = this.dragHandler;
    this.clickHandler = null;
    this.dragHandler = null;
    this.dragSession.end();
    this.contextMenuSuppressRemove();
    handler(event);
  }

  /**
   * Returns whether the travel so far still counts as a click.
   *
   * @returns True below the drag threshold.
   */
  private travelIsClick(): boolean {
    const travel = Math.max(this.relativeTravelPx, this.furthestClientTravelPx);
    return travel < FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX;
  }

  /**
   * Ends the gesture at its release and fires the click handler for a click.
   *
   * @param releaseEvent Release event, or null when blur ended the press.
   */
  private releaseFinish(releaseEvent: PointerEvent | null): void {
    const handler = this.clickHandler;
    this.clickHandler = null;
    this.contextMenuSuppressRemoveAfterRelease();
    if (!handler || !releaseEvent || releaseEvent.type !== 'pointerup') {
      return;
    }
    if (releaseEvent.button !== FACE_SECONDARY_CLICK_BUTTON || !this.travelIsClick()) {
      return;
    }
    handler(releaseEvent.altKey === true);
  }

  /**
   * Starts suppressing the browser context menu in a window.
   *
   * @param ownerWindow Window whose context menu is suppressed.
   */
  private contextMenuSuppressInstall(ownerWindow: Window): void {
    this.contextMenuWindow = ownerWindow;
    ownerWindow.addEventListener('contextmenu', this.contextMenuSuppressListener, true);
  }

  /**
   * Stops suppressing the context menu once the release's own context menu
   * event had its turn.
   */
  private contextMenuSuppressRemoveAfterRelease(): void {
    const ownerWindow = this.contextMenuWindow;
    if (!ownerWindow) {
      return;
    }
    ownerWindow.setTimeout(() => {
      if (this.contextMenuWindow === ownerWindow && !this.isArmed()) {
        this.contextMenuSuppressRemove();
      }
    }, 0);
  }

  /** Stops suppressing the context menu right away. */
  private contextMenuSuppressRemove(): void {
    this.contextMenuWindow?.removeEventListener('contextmenu', this.contextMenuSuppressListener, true);
    this.contextMenuWindow = null;
  }
}
