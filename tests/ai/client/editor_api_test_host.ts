import * as THREE from 'three';
import type { EditorApiHost } from '@/ai/client/editor_api_host.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import { SolidModelPanel } from '@/solid/ui/panel/solid_model_panel.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSnap } from '@/transform/snap/manager_snap.js';

/** Editor systems a test EditorApi host is built from. */
export interface EditorApiTestHostParts {
  world: THREE.Group;
  commandStack: CommandStack;
  host: EditorApiHost;
}

/**
 * Builds a minimal EditorApi host over a fresh world, command stack and
 * selection, with optional extra host hooks.
 *
 * @param hooks Optional host members to add or override.
 * @returns The world, command stack and host.
 */
export function editorApiTestHostCreate(hooks: Partial<EditorApiHost> = {}): EditorApiTestHostParts {
  const world = new THREE.Group();
  const commandStack = new CommandStack(64);
  const selectionManager = new ManagerSelection();
  const panel = new SolidModelPanel(document.createElement('div'), { onAddBoxBrush: () => undefined });
  const host: EditorApiHost = {
    worldObject: world,
    commandStack,
    selectionManager,
    solidModelController: new SolidModelController(world, commandStack, selectionManager, panel),
    gridSnap: new GridSnap(true, 0.25),
    snapManager: new ManagerSnap(0.25),
    getUserSnapEnabled: () => false,
    refreshAfterWorldMutation: () => undefined,
    refreshOutliner: () => undefined,
    showStatus: () => undefined,
    ...hooks,
  };
  return { world, commandStack, host };
}
