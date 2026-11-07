import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CoordinatorFaceModeSecondaryPress } from '@/tools/face/coordinator_face_mode_secondary_press.js';
import type { FaceTextureApplyCoordinator } from '@/tools/face/texture_apply/face_texture_apply_coordinator.js';

/** Viewport stand-in that records delayed right-button navigation. */
class SecondaryPressViewportStub {
  readonly beginSecondaryButtonNavigation = vi.fn();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly contentElement: HTMLDivElement;

  /** Creates a stub whose pick element lives in the test document. */
  constructor() {
    this.contentElement = document.createElement('div');
    document.body.appendChild(this.contentElement);
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

/**
 * Builds a texture-apply stand-in that records arm and dispose.
 *
 * @returns Texture apply coordinator stub and its spies.
 */
function textureApplyStubCreate(): {
  coordinator: FaceTextureApplyCoordinator;
  secondaryPressBegin: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  const secondaryPressBegin = vi.fn();
  const dispose = vi.fn();
  const coordinator = {
    secondaryPressBegin,
    secondaryPressIsArmed: () => secondaryPressBegin.mock.calls.length > dispose.mock.calls.length,
    dispose,
  } as unknown as FaceTextureApplyCoordinator;
  return { coordinator, secondaryPressBegin, dispose };
}

describe('CoordinatorFaceModeSecondaryPress', () => {
  const viewport = new SecondaryPressViewportStub();

  afterEach(() => {
    viewport.beginSecondaryButtonNavigation.mockClear();
  });

  it('starts a paint stroke without arming the texture apply click', () => {
    const textureApply = textureApplyStubCreate();
    const secondary = new CoordinatorFaceModeSecondaryPress(textureApply.coordinator, () => true);
    expect(secondary.pressBegin(viewport as never, 12, 18)).toEqual({
      viewportHit: true,
      strokeStarted: true,
    });
    expect(textureApply.secondaryPressBegin).not.toHaveBeenCalled();
    expect(secondary.applyClickIsArmed()).toBe(false);
  });

  it('arms the apply click and hands a drag to the pressed viewport once', () => {
    const textureApply = textureApplyStubCreate();
    const secondary = new CoordinatorFaceModeSecondaryPress(textureApply.coordinator, () => false);
    expect(secondary.pressBegin(viewport as never, 12, 18)).toEqual({
      viewportHit: true,
      strokeStarted: false,
    });
    expect(textureApply.secondaryPressBegin).toHaveBeenCalledTimes(1);
    const dragHandler = textureApply.secondaryPressBegin.mock.calls[0]?.[3] as
      ((event: PointerEvent) => void) | undefined;
    const move = new PointerEvent('pointermove', { clientX: 20, clientY: 18 });
    dragHandler?.(move);
    expect(viewport.beginSecondaryButtonNavigation).toHaveBeenCalledWith(move);
    secondary.dispose();
    expect(textureApply.dispose).toHaveBeenCalled();
  });

  it('cancels an armed apply click without starting navigation', () => {
    const textureApply = textureApplyStubCreate();
    const secondary = new CoordinatorFaceModeSecondaryPress(textureApply.coordinator, () => false);
    secondary.pressBegin(viewport as never, 12, 18);
    secondary.applyClickCancel();
    expect(textureApply.dispose).toHaveBeenCalledTimes(1);
    expect(viewport.beginSecondaryButtonNavigation).not.toHaveBeenCalled();
  });

  it('cancels the press instead of navigating when a second drag notice arrives without a viewport', () => {
    const textureApply = textureApplyStubCreate();
    const secondary = new CoordinatorFaceModeSecondaryPress(textureApply.coordinator, () => false);
    secondary.pressBegin(viewport as never, 12, 18);
    const dragHandler = textureApply.secondaryPressBegin.mock.calls[0]?.[3] as
      ((event: PointerEvent) => void) | undefined;
    const move = new PointerEvent('pointermove', { clientX: 20, clientY: 18 });
    dragHandler?.(move);
    const disposeCallsAfterHandOff = textureApply.dispose.mock.calls.length;
    dragHandler?.(move);
    expect(viewport.beginSecondaryButtonNavigation).toHaveBeenCalledTimes(1);
    expect(textureApply.dispose.mock.calls.length).toBe(disposeCallsAfterHandOff + 1);
  });
});
