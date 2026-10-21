import * as THREE from 'three';
import type { GridSnap } from '@/transform/snap/grid_snap.js';

/**
 * Read view of the working grid frame for object drags. Local coordinates use X
 * along the grid U axis, Y along the grid normal and Z along the grid V axis,
 * measured from the grid origin, so multiples of the grid interval lie on grid
 * lines.
 */
export class ObjectDragGridFrame {
  private readonly gridSnap: GridSnap;

  /**
   * Creates a grid frame view over the shared grid snap state.
   *
   * @param gridSnap Shared grid snap holding the working plane frame.
   */
  constructor(gridSnap: GridSnap) {
    this.gridSnap = gridSnap;
  }

  /**
   * Returns the grid step length in world units.
   *
   * @returns Grid interval (always above zero).
   */
  gridStep(): number {
    const interval = this.gridSnap.getInterval();
    return interval > 0 ? interval : 1;
  }

  /**
   * Returns the unit grid normal ("up" of the working grid).
   *
   * @returns New normal vector.
   */
  normalWorld(): THREE.Vector3 {
    return this.gridSnap.getPlaneFrame().normal.normalize();
  }

  /**
   * Returns the world point the grid plane passes through.
   *
   * @returns New origin point.
   */
  originWorld(): THREE.Vector3 {
    return this.gridSnap.getPlaneFrame().origin;
  }

  /**
   * Returns the rotation that maps grid-local axes onto world axes.
   *
   * @returns New quaternion.
   */
  orientationWorld(): THREE.Quaternion {
    const frame = this.gridSnap.getPlaneFrame();
    const basis = new THREE.Matrix4().makeBasis(frame.uAxis, frame.normal, frame.vAxis);
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }

  /**
   * Converts a world position into grid-local coordinates.
   *
   * @param worldPosition World position (not modified).
   * @returns New local position.
   */
  positionToLocal(worldPosition: THREE.Vector3): THREE.Vector3 {
    const localPosition = new THREE.Vector3();
    this.gridSnap.worldPositionToLocal(worldPosition.clone(), localPosition);
    return localPosition;
  }

  /**
   * Converts grid-local coordinates into a world position.
   *
   * @param localPosition Local position (not modified).
   * @returns New world position.
   */
  positionToWorld(localPosition: THREE.Vector3): THREE.Vector3 {
    const worldPosition = new THREE.Vector3();
    this.gridSnap.localToWorldPosition(localPosition.clone(), worldPosition);
    return worldPosition;
  }

  /**
   * Converts a free world vector into grid-local components.
   *
   * @param worldVector World vector (not modified).
   * @returns New local vector.
   */
  vectorToLocal(worldVector: THREE.Vector3): THREE.Vector3 {
    const localVector = new THREE.Vector3();
    this.gridSnap.worldVectorToLocal(worldVector.clone(), localVector);
    return localVector;
  }

  /**
   * Converts grid-local components into a free world vector.
   *
   * @param localVector Local vector (not modified).
   * @returns New world vector.
   */
  vectorToWorld(localVector: THREE.Vector3): THREE.Vector3 {
    const worldVector = new THREE.Vector3();
    this.gridSnap.localToWorldVector(localVector.clone(), worldVector);
    return worldVector;
  }
}
