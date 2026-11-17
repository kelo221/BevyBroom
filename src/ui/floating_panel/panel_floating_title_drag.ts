import { TextSelectionSuppression } from '@/ui/text_selection/text_selection_suppression.js';
import { clampFloatingPanelRectToScreen } from './panel_floating_screen_bounds.js';

/** What a title bar drag needs from its window. */
export interface PanelFloatingTitleDragHost {
  /** Window root moved by the drag. */
  readonly root: HTMLElement;
  /** Gap kept to the screen edges in CSS pixels. */
  readonly paddingPx: number;
  /** Runs when a drag begins, before the first move. */
  dragStarted(): void;
  /**
   * Moves the window to a top-left position.
   *
   * @param left CSS left in pixels.
   * @param top CSS top in pixels.
   */
  positionSet(left: number, top: number): void;
  /**
   * Runs after each move of the window.
   *
   * @param event Pointer move.
   */
  dragMoved(event: PointerEvent): void;
  /**
   * Runs when the drag ends.
   *
   * @param event Pointer release.
   */
  dragEnded(event: PointerEvent): void;
}

/**
 * Moves a floating window with its title bar, keeping it on screen and keeping
 * the page from selecting text during the drag.
 */
export class PanelFloatingTitleDrag {
  private readonly host: PanelFloatingTitleDragHost;
  private readonly textSelectionSuppression: TextSelectionSuppression;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private abortController: AbortController | null = null;

  /**
   * Creates the drag of one window.
   *
   * @param host Window callbacks.
   */
  constructor(host: PanelFloatingTitleDragHost) {
    this.host = host;
    this.textSelectionSuppression = new TextSelectionSuppression(host.root.ownerDocument);
  }

  /**
   * Starts dragging from a title bar press that is not on a button.
   *
   * @param event Pointer press on the title bar.
   */
  titleBarPressHandle(event: PointerEvent): void {
    const target = event.target;
    if (event.button !== 0 || (target instanceof HTMLElement && target.tagName === 'BUTTON')) {
      return;
    }
    this.begin(event);
  }

  /**
   * Starts dragging with the pointer at its current spot on the window.
   *
   * @param event Pointer event the drag starts from.
   */
  begin(event: PointerEvent): void {
    this.end();
    this.host.dragStarted();
    const rect = this.host.root.getBoundingClientRect();
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    this.host.root.style.position = 'fixed';
    this.host.positionSet(rect.left, rect.top);
    this.textSelectionSuppression.begin();
    this.listenersBind();
  }

  /** Binds window pointer move and release listeners for the drag. */
  private listenersBind(): void {
    const abortController = new AbortController();
    this.abortController = abortController;
    const options = { signal: abortController.signal };
    window.addEventListener('pointermove', (event) => this.move(event), options);
    window.addEventListener('pointerup', (event) => this.release(event), options);
  }

  /**
   * Moves the window with the pointer, clamped to the screen.
   *
   * @param event Pointer move.
   */
  private move(event: PointerEvent): void {
    const rect = this.host.root.getBoundingClientRect();
    const clamped = clampFloatingPanelRectToScreen(
      {
        left: event.clientX - this.dragOffsetX,
        top: event.clientY - this.dragOffsetY,
        width: rect.width,
        height: rect.height,
      },
      window.innerWidth,
      window.innerHeight,
      this.host.paddingPx,
    );
    this.host.positionSet(clamped.left, clamped.top);
    this.host.dragMoved(event);
  }

  /**
   * Ends the drag on pointer release.
   *
   * @param event Pointer release.
   */
  private release(event: PointerEvent): void {
    this.end();
    this.host.dragEnded(event);
  }

  /** Removes the drag listeners and lets the page select text again. */
  private end(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.textSelectionSuppression.end();
  }
}
