import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getVisGroupSharedServices,
  setVisGroupSharedServicesForTests,
  visGroupSharedServicesCreate,
} from '@/visgroup/visgroup_shared_services.js';

/**
 * Builds a world holding one box placed far outside a small Cordon around the
 * origin.
 *
 * @returns World root and the far box.
 */
function worldWithFarBoxCreate(): { world: THREE.Group; farBox: THREE.Mesh } {
  const world = new THREE.Group();
  const farBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  farBox.position.set(1000, 0, 0);
  world.add(farBox);
  world.updateMatrixWorld(true);
  return { world, farBox };
}

afterEach(() => {
  setVisGroupSharedServicesForTests(null);
});

describe('visGroupSharedServices', () => {
  it('returns the same services until they are replaced', () => {
    const first = getVisGroupSharedServices();
    expect(getVisGroupSharedServices()).toBe(first);
    setVisGroupSharedServicesForTests(null);
    expect(getVisGroupSharedServices()).not.toBe(first);
  });

  it('keeps an object hidden by a VisGroup after the Cordon that also hid it is turned off', () => {
    const services = visGroupSharedServicesCreate();
    const { world, farBox } = worldWithFarBoxCreate();
    const group = services.visGroupStore.userGroupCreate('Far things');
    services.visGroupStore.objectGroupAdd(farBox, group.id);
    services.visGroupStore.groupVisibleSet(group.id, false, world);
    services.cordonState.boundsWrite(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    services.cordonState.enabledWrite(true);
    services.cordonFilterApplier.apply(world);
    expect(farBox.visible).toBe(false);
    services.cordonState.enabledWrite(false);
    services.cordonFilterApplier.apply(world);
    expect(farBox.visible).toBe(false);
    services.visGroupStore.groupVisibleSet(group.id, true, world);
    expect(farBox.visible).toBe(true);
  });
});
