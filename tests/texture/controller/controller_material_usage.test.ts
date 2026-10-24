import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { ControllerMaterialUsage } from '@/texture/controller/controller_material_usage.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';

describe('ControllerMaterialUsage', () => {
  let world: THREE.Group;
  let selection: ManagerSelection;
  let faceController: ControllerFaceExtrusion;
  let controller: ControllerMaterialUsage;
  let brickMesh: THREE.Mesh;
  let rockMesh: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    selection = new ManagerSelection();
    faceController = new ControllerFaceExtrusion(new THREE.Scene(), new CommandStack(8), new GridSnap(false, 1), world);
    controller = new ControllerMaterialUsage(world, selection, faceController);
    brickMesh = createMesh('brick.png');
    rockMesh = createMesh('rock.png');
    world.add(brickMesh, rockMesh);
  });

  it('selects the face regions using a material and switches to face mode', () => {
    const count = controller.selectFacesUsingTexture('brick.png');
    expect(count).toBe(getFaceTextureMaps(brickMesh).length);
    expect(faceController.getSelectionMode()).toBe(SelectionMode.FACE);
    expect(faceController.getSelectedFaces().length).toBeGreaterThan(0);
    expect(faceController.getSelectedFaces().every((face) => face.mesh === brickMesh)).toBe(true);
  });

  it('selects the objects using a material', () => {
    const count = controller.selectObjectsUsingTexture('rock.png');
    expect(count).toBe(1);
    expect(selection.getAllSelectedObjectsAsArray()).toEqual([rockMesh]);
  });

  it('reports zero when nothing uses the material', () => {
    expect(controller.selectFacesUsingTexture('missing.png')).toBe(0);
    expect(controller.selectObjectsUsingTexture('missing.png')).toBe(0);
  });
});

/**
 * Creates a textured box using one material id.
 *
 * @param textureId Material identity on every face.
 * @returns Content mesh.
 */
function createMesh(textureId: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.updateMatrixWorld(true);
  initializeMeshTextureUVs(mesh, textureId);
  return mesh;
}
