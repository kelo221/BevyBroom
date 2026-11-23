import type * as THREE from 'three';

/**
 * Distance in CSS pixels the pointer must travel before a press becomes a line
 * drag.
 */
export const CLIP_LINE_DRAG_THRESHOLD_PIXELS = 4;

/**
 * Press that placed point 1: while the button stays down, moving the pointer
 * drags out point 2, and releasing after a real move places it. A press that
 * never moves stays a plain click.
 */
export class ClipPlaneLineDrag {
  readonly camera: THREE.Camera;
  readonly pickElement: HTMLElement;
  private readonly pressClientX: number;
  private readonly pressClientY: number;
  private hasMoved: boolean;

  /**
   * Starts a line drag at the press position.
   *
   * @param camera Camera of the pane that was pressed.
   * @param pickElement Pick element of that pane.
   * @param pressClientX Press client X.
   * @param pressClientY Press client Y.
   */
  constructor(camera: THREE.Camera, pickElement: HTMLElement, pressClientX: number, pressClientY: number) {
    this.camera = camera;
    this.pickElement = pickElement;
    this.pressClientX = pressClientX;
    this.pressClientY = pressClientY;
    this.hasMoved = false;
  }

  /**
   * Records a pointer move and returns whether the drag has travelled far
   * enough to count as a line drag.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns True once the pointer moved past the threshold.
   */
  pointerMove(clientX: number, clientY: number): boolean {
    const distance = Math.hypot(clientX - this.pressClientX, clientY - this.pressClientY);
    if (distance >= CLIP_LINE_DRAG_THRESHOLD_PIXELS) this.hasMoved = true;
    return this.hasMoved;
  }

  /**
   * Returns whether the pointer has moved past the threshold since the press.
   *
   * @returns True for a real drag.
   */
  isDragged(): boolean {
    return this.hasMoved;
  }
}
