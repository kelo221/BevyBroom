import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ENTITY_HANDLE_SNAP_NONE } from '@/entity/handles/entity_handle.js';
import { EntityHandleSystem } from '@/entity/handles/entity_handle_system.js';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { ManagerShadingMode } from '@/viewports/shading/manager_shading_mode.js';
import { shadingExemptFlag, shadingExemptIs } from '@/viewports/shading/shading_exempt.js';

/**
 * Builds a scene with a world holding a selected spot light, its handle balls
 * and an ordinary box.
 *
 * @returns Scene, light, box and the handle system.
 */
function sceneCreate(): { scene: THREE.Scene; light: THREE.Group; box: THREE.Mesh; handles: EntityHandleSystem } {
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const light = LightOwner.createDefault('Spot', 'spot');
  const box = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  world.add(light, box);
  const selection = { getSelectedObjects: () => [light], onSelectionChanged: () => undefined };
  const handles = new EntityHandleSystem({
    worldObject: world,
    selection,
    commandStack: new CommandStack(4),
    snap: ENTITY_HANDLE_SNAP_NONE,
  });
  handles.refresh();
  return { scene, light, box, handles };
}

/**
 * Returns the materials of the light box, the light icon and every handle ball.
 *
 * @param light Light owner.
 * @param handles Handle system.
 * @returns Live materials.
 */
function entityMaterialsRead(light: THREE.Object3D, handles: EntityHandleSystem): unknown[] {
  const meshes = [LightOwner.markerOf(light), EntityVisualBillboard.iconFind(light), ...handles.overlay.group.children];
  return meshes.map((mesh) => (mesh instanceof THREE.Mesh ? mesh.material : null));
}

describe('shading exemption', () => {
  it('flags only the objects it is given', () => {
    const flagged = new THREE.Mesh();
    shadingExemptFlag(flagged);
    expect(shadingExemptIs(flagged)).toBe(true);
    expect(shadingExemptIs(new THREE.Mesh())).toBe(false);
  });

  it('keeps entity boxes, icons and handle balls drawn in wireframe panes while content is hidden', () => {
    const { scene, light, box, handles } = sceneCreate();
    const entityMaterials = entityMaterialsRead(light, handles);
    expect(entityMaterials.every((material) => material instanceof THREE.Material)).toBe(true);
    expect(handles.overlay.group.children).toHaveLength(2);
    const boxMaterial = box.material;
    const manager = new ManagerShadingMode(scene);
    manager.snapshotMaterials();
    manager.setMode(ShadingMode.WIREFRAME);
    expect(entityMaterialsRead(light, handles)).toEqual(entityMaterials);
    expect(box.material).not.toBe(boxMaterial);
    manager.setMode(ShadingMode.SOLID);
    expect(box.material).toBe(boxMaterial);
  });
});
