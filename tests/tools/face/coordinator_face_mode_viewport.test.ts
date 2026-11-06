import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coordinatorFaceModeViewportAtClientPoint } from '@/tools/face/coordinator_face_mode_viewport.js';

/** Viewport stand-in with a sized pick element. */
class ViewportStub {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly contentElement: HTMLDivElement;

  /**
   * Creates a stub whose pick element covers the given rectangle.
   *
   * @param left Left of the pick rectangle.
   * @param top Top of the pick rectangle.
   */
  constructor(left: number, top: number) {
    this.camera = new THREE.PerspectiveCamera();
    this.contentElement = document.createElement('div');
    document.body.appendChild(this.contentElement);
    this.contentElement.getBoundingClientRect = () =>
      ({
        left,
        top,
        right: left + 100,
        bottom: top + 100,
        width: 100,
        height: 100,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
  }

  /**
   * Returns the stub camera.
   *
   * @returns Perspective camera.
   */
  getCamera(): THREE.Camera {
    return this.camera;
  }

  /**
   * Returns the pick element.
   *
   * @returns Content element.
   */
  getContentElement(): HTMLElement {
    return this.contentElement;
  }

  /** Removes the pick element from the document. */
  dispose(): void {
    this.contentElement.remove();
  }
}

describe('coordinatorFaceModeViewportAtClientPoint', () => {
  it('returns the viewport under the point only while face mode is active', () => {
    const viewport = new ViewportStub(0, 0);
    const viewports = [viewport] as never;
    expect(coordinatorFaceModeViewportAtClientPoint(false, viewports, 40, 40, document)).toBeNull();
    expect(coordinatorFaceModeViewportAtClientPoint(true, viewports, 40, 40, document)).toBe(viewport);
    expect(coordinatorFaceModeViewportAtClientPoint(true, viewports, 400, 400, document)).toBeNull();
    viewport.dispose();
  });
});
