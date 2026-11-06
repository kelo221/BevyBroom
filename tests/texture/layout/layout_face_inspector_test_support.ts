import * as THREE from 'three';
import { vi } from 'vitest';
import { faceInspectorSetup, type FaceInspectorSetupResult } from '@/texture/layout/layout_face_inspector_setup.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { setTextureMapCacheForTests, TextureMapCache } from '@/texture/library/texture_map_cache.js';
import { setStateFaceEditSessionForTests, StateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { mockObjectUrlApis } from '../library/utils_object_url_test.js';

/** Face inspector built over an empty world with the services it was given. */
export interface FaceInspectorTestParts {
  readonly parts: FaceInspectorSetupResult;
  readonly world: THREE.Group;
  readonly selectionManager: ManagerSelection;
  readonly commandStack: CommandStack;
  readonly afterSurfaceChange: ReturnType<typeof vi.fn<() => void>>;
}

/**
 * Installs fresh texture paint, texture cache and face edit session singletons
 * and builds a face inspector over an empty world.
 *
 * @returns Face inspector and its services.
 */
export function faceInspectorTestPartsCreate(): FaceInspectorTestParts {
  mockObjectUrlApis('blob:face-inspector-test');
  setStateTexturePaintForTests(new StateTexturePaint());
  setTextureMapCacheForTests(new TextureMapCache());
  setStateFaceEditSessionForTests(new StateFaceEditSession());
  const world = new THREE.Group();
  const selectionManager = new ManagerSelection();
  const commandStack = new CommandStack(32);
  const afterSurfaceChange = vi.fn<() => void>();
  const faceController = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), world);
  const parts = faceInspectorSetup({
    selectionManager,
    faceController,
    commandStack,
    statusBar: null,
    afterSurfaceChange,
  });
  return { parts, world, selectionManager, commandStack, afterSurfaceChange };
}

/**
 * Disposes a face inspector built by {@link faceInspectorTestPartsCreate} and
 * drops the singletons it installed.
 *
 * @param testParts Face inspector and its services.
 */
export function faceInspectorTestPartsDispose(testParts: FaceInspectorTestParts): void {
  testParts.parts.faceInspector.dispose();
  testParts.parts.textureBrowserController.dispose();
  setStateTexturePaintForTests(null);
  setTextureMapCacheForTests(null);
  setStateFaceEditSessionForTests(null);
  vi.restoreAllMocks();
}

/**
 * Returns whether an element or any ancestor below a root is hidden with
 * display none.
 *
 * @param element Element to check.
 * @param root Ancestor where the walk stops.
 * @returns True when the element is hidden by display none.
 */
export function elementHiddenByDisplayIs(element: Element, root: Element): boolean {
  let current: Element | null = element;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.style.display === 'none') {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}
