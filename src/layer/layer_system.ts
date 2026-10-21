import type * as THREE from 'three';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { LayerRenderSuppression } from '@/layer/render/layer_render_suppression.js';
import { LayerSelectionGuard } from '@/layer/selection/layer_selection_guard.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';

/**
 * The layers of an editor world together with the parts that make hidden and
 * locked layers take effect in the viewports and the selection.
 */
export class LayerSystem {
  readonly layerManager: LayerManager;
  readonly renderSuppression: LayerRenderSuppression;
  readonly selectionGuard: LayerSelectionGuard;

  /**
   * Creates the layer manager of a world root, the render suppression of hidden
   * layers and the selection guard.
   *
   * @param worldGroup World root.
   * @param selectionManager Object selection.
   */
  constructor(worldGroup: THREE.Object3D, selectionManager: ManagerSelection) {
    this.layerManager = new LayerManager(worldGroup);
    this.renderSuppression = new LayerRenderSuppression(this.layerManager);
    this.selectionGuard = new LayerSelectionGuard(this.layerManager, selectionManager);
  }

  /** Releases the guard, the render hook and the manager. */
  dispose(): void {
    this.selectionGuard.dispose();
    this.renderSuppression.dispose();
    this.layerManager.dispose();
  }
}
