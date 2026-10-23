import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { createContentMaterial } from '@/materials/factory_content_material.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import { createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { setTextureMapCacheForTests, TextureMapCache } from '@/texture/library/texture_map_cache.js';
import { mockObjectUrlApis } from '../../texture/library/utils_object_url_test.js';

describe('ControllerTextureAssignment content-mesh face painting', () => {
  let world: THREE.Group;
  let faceController: ControllerFaceExtrusion;
  let commandStack: CommandStack;
  let controller: ControllerTextureAssignment;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    mockObjectUrlApis('blob:content-faces');
    setStateTexturePaintForTests(new StateTexturePaint());
    setTextureMapCacheForTests(new TextureMapCache());
    world = new THREE.Group();
    commandStack = new CommandStack(64);
    faceController = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), world);
    controller = new ControllerTextureAssignment(new ManagerSelection(), faceController, commandStack);
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), createContentMaterial(0x888888));
    mesh.updateMatrixWorld(true);
    initializeMeshTextureUVs(mesh, DEFAULT_CHECKER_TEXTURE_ID);
    world.add(mesh);
  });

  afterEach(() => {
    setStateTexturePaintForTests(null);
    setTextureMapCacheForTests(null);
    vi.restoreAllMocks();
  });

  it('paints selected content-mesh faces in face mode with one undo entry', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    const entry = createTextureBrowserEntry(new File(['x'], 'rock.png', { type: 'image/png' }), 'rock.png');
    controller.onTextureSelected(entry);
    expect(commandStack.getUndoCount()).toBe(1);
    expect(getFaceTextureMaps(mesh).some((stored) => stored.mapping.textureId === 'rock.png')).toBe(true);
  });

  it('restores the prior material on undo', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    const entry = createTextureBrowserEntry(new File(['x'], 'rock.png', { type: 'image/png' }), 'rock.png');
    controller.onTextureSelected(entry);
    commandStack.undo();
    expect(getFaceTextureMaps(mesh).every((stored) => stored.mapping.textureId !== 'rock.png')).toBe(true);
  });

  it('keeps reporting guidance when no faces are selected in face mode', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    const status = vi.fn();
    controller.setStatusCallback(status);
    const entry = createTextureBrowserEntry(new File(['x'], 'rock.png', { type: 'image/png' }), 'rock.png');
    controller.onTextureSelected(entry);
    expect(commandStack.getUndoCount()).toBe(0);
    expect(status).toHaveBeenCalled();
  });
});
