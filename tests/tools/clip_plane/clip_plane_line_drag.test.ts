import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ClipPlaneLineDrag, CLIP_LINE_DRAG_THRESHOLD_PIXELS } from '@/tools/clip_plane/clip_plane_line_drag.js';

/** Proves when a press that placed point 1 turns into a line drag. */
describe('ClipPlaneLineDrag', () => {
  /**
   * Starts a line drag at a fixed press position.
   *
   * @returns Line drag.
   */
  function lineDragCreate(): ClipPlaneLineDrag {
    return new ClipPlaneLineDrag(new THREE.OrthographicCamera(), document.createElement('div'), 100, 100);
  }

  it('stays a click while the pointer moves less than the threshold', () => {
    const lineDrag = lineDragCreate();
    expect(lineDrag.pointerMove(100 + CLIP_LINE_DRAG_THRESHOLD_PIXELS / 2, 100)).toBe(false);
    expect(lineDrag.isDragged()).toBe(false);
  });

  it('becomes a drag past the threshold and stays one when the pointer comes back', () => {
    const lineDrag = lineDragCreate();
    expect(lineDrag.pointerMove(100, 100 + CLIP_LINE_DRAG_THRESHOLD_PIXELS)).toBe(true);
    expect(lineDrag.pointerMove(100, 100)).toBe(true);
    expect(lineDrag.isDragged()).toBe(true);
  });
});
