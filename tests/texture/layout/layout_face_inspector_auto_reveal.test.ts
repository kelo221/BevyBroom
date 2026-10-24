import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { faceInspectorSetup, type FaceInspectorSetupResult } from '@/texture/layout/layout_face_inspector_setup.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { setTextureMapCacheForTests, TextureMapCache } from '@/texture/library/texture_map_cache.js';
import { mockObjectUrlApis } from '../library/utils_object_url_test.js';

describe('face inspector auto-reveal', () => {
  let world: THREE.Group;
  let selection: ManagerSelection;
  let faceController: ControllerFaceExtrusion;
  let commandStack: CommandStack;
  let reveal: ReturnType<typeof vi.fn<() => void>>;
  let revealEnabled: ReturnType<typeof vi.fn<() => boolean>>;
  let result: FaceInspectorSetupResult;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    mockObjectUrlApis('blob:auto-reveal');
    setStateTexturePaintForTests(new StateTexturePaint());
    setTextureMapCacheForTests(new TextureMapCache());
    world = new THREE.Group();
    selection = new ManagerSelection();
    commandStack = new CommandStack(64);
    faceController = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), world);
    reveal = vi.fn<() => void>();
    revealEnabled = vi.fn<() => boolean>(() => true);
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    initializeMeshTextureUVs(mesh, 'checker');
    world.add(mesh);
  });

  afterEach(() => {
    result.faceInspector.dispose();
    result.textureBrowserController.dispose();
    setStateTexturePaintForTests(null);
    setTextureMapCacheForTests(null);
    vi.restoreAllMocks();
  });

  it('reveals the Face tab when faces become selected and the setting is on', () => {
    result = setupWithReveal();
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    expect(reveal).toHaveBeenCalled();
  });

  it('does not reveal while the setting is off', () => {
    revealEnabled.mockReturnValue(false);
    result = setupWithReveal();
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    expect(reveal).not.toHaveBeenCalled();
  });

  it('does not reveal when the selection empties', () => {
    result = setupWithReveal();
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    reveal.mockClear();
    faceController.setSelectionMode(SelectionMode.OBJECT);
    expect(reveal).not.toHaveBeenCalled();
  });

  /**
   * Builds the inspector with the reveal hooks attached.
   *
   * @returns Setup result.
   */
  function setupWithReveal(): FaceInspectorSetupResult {
    return faceInspectorSetup({
      selectionManager: selection,
      faceController,
      commandStack,
      statusBar: null,
      afterSurfaceChange: () => undefined,
      gridSnap: new GridSnap(false, 1),
      revealFaceInspector: reveal,
      isFaceInspectorAutoRevealEnabled: revealEnabled,
      worldObject: world,
    });
  }
});
