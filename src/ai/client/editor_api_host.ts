import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { ManagerSnap } from '@/transform/snap/manager_snap.js';
import type { PreviewLinkService } from '@/preview/link/preview_link_service.js';

/**
 * Dependencies injected into EditorApi once at layout bootstrap. Keeps AI code
 * from reaching into layout managers directly.
 */
export interface EditorApiHost {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  solidModelController: SolidModelController;
  gridSnap: GridSnap;
  snapManager: ManagerSnap;
  getUserSnapEnabled: () => boolean;
  refreshAfterWorldMutation: () => void;
  refreshOutliner: () => void;
  showStatus: (message: string) => void;
  /**
   * Shared editor scene for capture_view. Set by layout bootstrap; unit tests
   * may omit it.
   */
  getScene?: () => THREE.Scene | null;
  /**
   * Shared WebGL renderer for capture_view. Set by layout bootstrap; unit tests
   * may omit it.
   */
  getRenderer?: () => THREE.WebGLRenderer | null;
  /**
   * Returns the game preview link, creating it on first use. Set by layout
   * bootstrap; unit tests may omit it.
   */
  previewLinkServiceEnsure?: () => PreviewLinkService;
  /**
   * Replaces the open scene with scene file text as Load does. Set by layout
   * bootstrap; unit tests may omit it.
   *
   * @param sceneJson Scene file text.
   * @returns True when the scene loaded.
   */
  sceneDocumentLoad?: (sceneJson: string) => boolean;
}
