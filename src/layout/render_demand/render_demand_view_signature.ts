import type * as THREE from 'three';

/**
 * Numbers stored per camera: its world matrix followed by its projection
 * matrix.
 */
const RENDER_DEMAND_VIEW_SIGNATURE_NUMBERS_PER_CAMERA = 32;

/**
 * Remembers which cameras were drawn last and where they looked, so a frame can
 * tell whether any view moved, zoomed or was swapped since the last drawing.
 */
export class RenderDemandViewSignature {
  private recordedCameras: THREE.Camera[];
  private recordedNumbers: Float64Array;

  /** Creates an empty signature that differs from any list of cameras. */
  constructor() {
    this.recordedCameras = [];
    this.recordedNumbers = new Float64Array(0);
  }

  /**
   * Returns whether the cameras differ from the recorded ones in identity,
   * count, placement or projection.
   *
   * @param cameras Cameras of the views about to be drawn, in pane order.
   * @returns True when the views changed since the last record.
   */
  isChanged(cameras: readonly THREE.Camera[]): boolean {
    if (cameras.length !== this.recordedCameras.length) {
      return true;
    }
    for (let cameraIndex = 0; cameraIndex < cameras.length; cameraIndex++) {
      if (this.isCameraChanged(cameras, cameraIndex)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Stores the identity, placement and projection of the given cameras.
   *
   * @param cameras Cameras of the views that were just drawn, in pane order.
   */
  record(cameras: readonly THREE.Camera[]): void {
    this.recordedCameras = cameras.slice();
    this.recordedNumbersEnsureLength(cameras.length * RENDER_DEMAND_VIEW_SIGNATURE_NUMBERS_PER_CAMERA);
    for (let cameraIndex = 0; cameraIndex < cameras.length; cameraIndex++) {
      this.cameraNumbersWrite(cameras, cameraIndex);
    }
  }

  /**
   * Returns whether one camera is a different object, or looks differently,
   * than the recorded camera at the same pane index.
   *
   * @param cameras Cameras about to be drawn.
   * @param cameraIndex Pane index of the camera to compare.
   * @returns True when that camera changed.
   */
  private isCameraChanged(cameras: readonly THREE.Camera[], cameraIndex: number): boolean {
    const camera = cameras[cameraIndex];
    if (!camera || camera !== this.recordedCameras[cameraIndex]) {
      return true;
    }
    camera.updateMatrixWorld();
    const offset = cameraIndex * RENDER_DEMAND_VIEW_SIGNATURE_NUMBERS_PER_CAMERA;
    return (
      this.isMatrixChanged(camera.matrixWorld.elements, offset) ||
      this.isMatrixChanged(camera.projectionMatrix.elements, offset + 16)
    );
  }

  /**
   * Returns whether sixteen matrix elements differ from the recorded numbers.
   *
   * @param elements Matrix elements to compare.
   * @param offset First recorded number to compare against.
   * @returns True when any element differs.
   */
  private isMatrixChanged(elements: readonly number[], offset: number): boolean {
    for (let elementIndex = 0; elementIndex < 16; elementIndex++) {
      if (elements[elementIndex] !== this.recordedNumbers[offset + elementIndex]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Writes one camera's world and projection matrices into the recorded
   * numbers.
   *
   * @param cameras Cameras that were drawn.
   * @param cameraIndex Pane index of the camera to write.
   */
  private cameraNumbersWrite(cameras: readonly THREE.Camera[], cameraIndex: number): void {
    const camera = cameras[cameraIndex];
    if (!camera) {
      return;
    }
    camera.updateMatrixWorld();
    const offset = cameraIndex * RENDER_DEMAND_VIEW_SIGNATURE_NUMBERS_PER_CAMERA;
    this.recordedNumbers.set(camera.matrixWorld.elements, offset);
    this.recordedNumbers.set(camera.projectionMatrix.elements, offset + 16);
  }

  /**
   * Grows the recorded number buffer when more cameras are recorded than
   * before.
   *
   * @param requiredLength Number of numbers the buffer must hold.
   */
  private recordedNumbersEnsureLength(requiredLength: number): void {
    if (this.recordedNumbers.length < requiredLength) {
      this.recordedNumbers = new Float64Array(requiredLength);
    }
  }
}
