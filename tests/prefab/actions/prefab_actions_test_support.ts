import * as THREE from 'three';
import { PrefabEditorActions } from '@/prefab/actions/prefab_editor_actions.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';
import type { ProjectDataFileChangeResult } from '@/project/data/project_data_file_types.js';
import type { DialogPromptAnswer, DialogPromptFieldsOptions } from '@/ui/dialog/dialog_prompt_fields.js';
import { clipboardTestWorldCreate, type ClipboardTestWorld } from '../../clipboard/clipboard_test_world.js';

/**
 * Prefab actions over a test world, with recorded prompts, reveals and status
 * messages.
 */
export interface PrefabActionsTestRig {
  readonly testWorld: ClipboardTestWorld;
  readonly store: PrefabCatalogStore;
  readonly actions: PrefabEditorActions;
  /** Every prompt shown, in order. */
  readonly prompts: DialogPromptFieldsOptions[];
  /** Answers the next prompts give, in order; an empty queue cancels. */
  readonly promptAnswers: (DialogPromptAnswer | null)[];
  /** File names asked to be revealed. */
  readonly revealedFiles: string[];
  /** Status messages reported. */
  readonly statusMessages: string[];
  /** Camera of the active view; null when there is none. */
  activeCamera: THREE.Camera | null;
  /** Result the next reveal reports. */
  revealResult: ProjectDataFileChangeResult;
}

/**
 * Builds prefab actions over an empty test world and a catalog.
 *
 * @param store Catalog the actions work on; a fresh one when omitted.
 * @returns Test rig.
 */
export function prefabActionsTestRigCreate(store: PrefabCatalogStore = new PrefabCatalogStore()): PrefabActionsTestRig {
  const testWorld = clipboardTestWorldCreate();
  const rig: Omit<PrefabActionsTestRig, 'actions'> = {
    testWorld,
    store,
    prompts: [],
    promptAnswers: [],
    revealedFiles: [],
    statusMessages: [],
    activeCamera: null,
    revealResult: { ok: true },
  };
  const actions = new PrefabEditorActions({
    store,
    worldObject: testWorld.world,
    commandRun: (command) => testWorld.commandStack.push(command),
    clipboardControllerRead: () => testWorld.controller,
    selectedObjectsRead: () => testWorld.selectionManager.getInspectorObjects(),
    activeCameraRead: () => rig.activeCamera,
    prefabFileReveal: async (fileName) => prefabActionsTestReveal(rig, fileName),
    statusReport: (message) => rig.statusMessages.push(message),
    promptShow: async (options) => prefabActionsTestPrompt(rig, options),
  });
  return Object.assign(rig, { actions });
}

/**
 * Records a reveal and answers with the rig's next result.
 *
 * @param rig Test rig.
 * @param fileName File name asked to be revealed.
 * @returns Reveal result.
 */
function prefabActionsTestReveal(
  rig: Omit<PrefabActionsTestRig, 'actions'>,
  fileName: string,
): ProjectDataFileChangeResult {
  rig.revealedFiles.push(fileName);
  return rig.revealResult;
}

/**
 * Records a prompt and answers with the next queued answer.
 *
 * @param rig Test rig.
 * @param options Prompt shown.
 * @returns Next answer, or null when none is queued.
 */
function prefabActionsTestPrompt(
  rig: Omit<PrefabActionsTestRig, 'actions'>,
  options: DialogPromptFieldsOptions,
): DialogPromptAnswer | null {
  rig.prompts.push(options);
  return rig.promptAnswers.shift() ?? null;
}

/**
 * Adds a box mesh of a given size whose bottom centre sits at a point.
 *
 * @param world World root.
 * @param name Mesh name.
 * @param size Box size.
 * @param bottomCentre World point under the middle of the box.
 * @returns The mesh.
 */
export function prefabActionsTestBoxAdd(
  world: THREE.Object3D,
  name: string,
  size: THREE.Vector3,
  bottomCentre: THREE.Vector3,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial());
  mesh.name = name;
  mesh.position.copy(bottomCentre).setY(bottomCentre.y + size.y / 2);
  world.add(mesh);
  world.updateMatrixWorld(true);
  return mesh;
}

/**
 * Captures objects as a prefab in the rig's catalog, failing the test when
 * nothing was captured.
 *
 * @param rig Test rig.
 * @param name Prefab name.
 * @param category Prefab category.
 * @param objects Objects to capture.
 * @returns Stored prefab.
 */
export function prefabActionsTestTemplateAdd(
  rig: PrefabActionsTestRig,
  name: string,
  category: string,
  objects: THREE.Object3D[],
): PrefabTemplate {
  const template = rig.store.templateCapture(name, category, objects);
  if (template === null) {
    throw new Error('the test objects can be captured');
  }
  rig.store.templateAdd(template);
  return template;
}

/**
 * Returns the world bounds of placed objects.
 *
 * @param roots Placed roots.
 * @returns World bounds.
 */
export function prefabActionsTestBoundsRead(roots: readonly THREE.Object3D[]): THREE.Box3 {
  const bounds = new THREE.Box3();
  roots.forEach((root) => {
    root.updateWorldMatrix(true, true);
    bounds.expandByObject(root);
  });
  return bounds;
}
