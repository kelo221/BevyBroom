import * as THREE from 'three';
import { displacementOverlayHelperMark } from './displacement_overlay_helper_flags.js';

/**
 * Base of the viewport helpers drawn over one displacement surface. The root
 * group copies the surface mesh's world matrix instead of composing its own
 * transform, so the part lives outside the world hierarchy yet sits exactly on
 * the surface.
 */
export abstract class DisplacementOverlayPart {
  /** Root group holding the part's drawable objects. */
  readonly root: THREE.Group;

  /**
   * Creates the part root and marks the drawables as editor-only helpers.
   *
   * @param name Scene name of the root group.
   * @param drawables Objects drawn by the part.
   */
  protected constructor(name: string, drawables: readonly THREE.Object3D[]) {
    this.root = new THREE.Group();
    this.root.name = name;
    this.root.matrixAutoUpdate = false;
    drawables.forEach((drawable) => this.root.add(drawable));
    displacementOverlayHelperMark(this.root);
  }

  /**
   * Places the part with a world matrix.
   *
   * @param worldMatrix World matrix of the followed surface mesh.
   */
  matrixFollow(worldMatrix: THREE.Matrix4): void {
    this.root.matrix.copy(worldMatrix);
    this.root.matrixWorldNeedsUpdate = true;
  }

  /**
   * Shows or hides the part.
   *
   * @param visible True to draw the part.
   */
  visibleWrite(visible: boolean): void {
    this.root.visible = visible;
  }

  /** Detaches the part and releases its geometries. */
  dispose(): void {
    this.root.removeFromParent();
    this.geometriesDispose();
  }

  /** Releases the geometries the part owns. */
  protected abstract geometriesDispose(): void;
}
