import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_KIND_USERDATA_KEY, entityKindRegister } from '@/entity/model/entity_owner_keys.js';
import { VisGroupClassifierAuto } from '@/visgroup/visgroup_classifier_auto.js';
import { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { StateCordon } from '@/cordon/state_cordon.js';
import { CordonFilterApplier } from '@/cordon/cordon_filter_applier.js';
import { CordonVisualHelper } from '@/cordon/cordon_visual_helper.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('VisGroupStore, VisGroupClassifierAuto, and Cordon', () => {
  it('supports multi-group user VisGroup membership, visibility toggling, and Mark selection', () => {
    const world = new THREE.Group();
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    world.add(meshA, meshB);

    const store = new VisGroupStore();
    const g1 = store.userGroupCreate('Walls');
    const g2 = store.userGroupCreate('Props');
    store.objectGroupAdd(meshA, g1.id);
    store.objectGroupAdd(meshA, g2.id);
    store.objectGroupAdd(meshB, g2.id);

    expect(store.objectGroupIdsRead(meshA)).toEqual([g1.id, g2.id]);

    store.groupVisibleSet(g1.id, false, world);
    expect(meshA.visible).toBe(false);
    expect(meshB.visible).toBe(true);

    store.groupVisibleSet(g1.id, true, world);
    expect(meshA.visible).toBe(true);

    const setSelection = vi.fn(() => true);
    const count = store.groupMembersMark(g2.id, world, {
      setSelection,
      getInspectorObjects: () => [meshA, meshB],
    });
    expect(count).toBe(2);
    expect(setSelection).toHaveBeenCalledTimes(1);
  });

  it('classifies meshes and light entities into Auto VisGroups and filters them', () => {
    const world = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    entityKindRegister('light');
    const lightOwner = new THREE.Group();
    lightOwner.userData[ENTITY_KIND_USERDATA_KEY] = 'light';
    world.add(mesh, lightOwner);

    expect(VisGroupClassifierAuto.classify(mesh)).toEqual(['all', 'world_geometry', 'meshes']);
    expect(VisGroupClassifierAuto.classify(lightOwner)).toEqual(['all', 'entities', 'lights']);

    const store = new VisGroupStore();
    store.groupVisibleSet('lights', false, world);
    expect(lightOwner.visible).toBe(false);
    expect(mesh.visible).toBe(true);
  });

  it('filters objects outside Cordon bounds, restores visibility on disable, and marks helper non-exportable', () => {
    const world = new THREE.Group();
    const insideMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    insideMesh.position.set(0, 0, 0);
    const outsideMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    outsideMesh.position.set(100, 100, 100);
    world.add(insideMesh, outsideMesh);
    world.updateMatrixWorld(true);

    const cordon = new StateCordon();
    cordon.boundsWrite(new THREE.Vector3(-5, -5, -5), new THREE.Vector3(5, 5, 5));
    const applier = new CordonFilterApplier(cordon);
    const visual = new CordonVisualHelper(cordon);

    expect(visual.objectRead().userData['exportable']).toBe(false);
    expect(visual.objectRead().userData['isEditorHelper']).toBe(true);

    cordon.enabledWrite(true);
    applier.apply(world);
    expect(insideMesh.visible).toBe(true);
    expect(outsideMesh.visible).toBe(false);

    cordon.enabledWrite(false);
    applier.apply(world);
    expect(outsideMesh.visible).toBe(true);
    visual.dispose();
  });
});
