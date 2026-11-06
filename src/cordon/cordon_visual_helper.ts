import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { EDITOR_HELPER_USERDATA_KEY } from '@/visgroup/visgroup_object_collector.js';
import type { StateCordon } from './state_cordon.js';

/**
 * Builds and updates an editor-only wireframe box helper showing the active
 * Cordon volume in the viewports. Marked non-exportable so it never ships in
 * GLBs.
 */
export class CordonVisualHelper {
  private readonly helper: THREE.Box3Helper;
  private readonly state: StateCordon;
  private readonly unsubscribe: () => void;

  /**
   * Creates a wireframe helper synced with the given Cordon state.
   *
   * @param state Cordon state to visualize.
   */
  constructor(state: StateCordon) {
    this.state = state;
    this.helper = new THREE.Box3Helper(state.boundsRead(), Theme.cordonColor);
    this.helper.name = '__cordon_bounds_helper__';
    this.helper.userData[EDITOR_HELPER_USERDATA_KEY] = true;
    this.helper.userData['exportable'] = false;
    this.syncFromState();
    this.unsubscribe = this.state.changeListenerAdd(() => this.syncFromState());
  }

  /**
   * Returns the Three.js helper object.
   *
   * @returns Box3Helper instance.
   */
  objectRead(): THREE.Box3Helper {
    return this.helper;
  }

  /** Unsubscribes from state updates and disposes helper geometry/material. */
  dispose(): void {
    this.unsubscribe();
    this.helper.removeFromParent();
    this.helper.dispose();
  }

  /** Updates helper box and visibility from the Cordon state. */
  private syncFromState(): void {
    this.helper.box.copy(this.state.boundsRead());
    this.helper.visible = this.state.enabledRead();
    this.helper.updateMatrixWorld(true);
  }
}
