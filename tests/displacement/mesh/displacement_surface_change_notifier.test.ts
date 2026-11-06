import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DisplacementSurfaceChangeNotifier } from '@/displacement/mesh/displacement_surface_change_notifier.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../displacement_test_rig.js';

const unsubscribers: Array<() => void> = [];

/**
 * Records every solid root the notifier reports.
 *
 * @returns List that receives notified roots.
 */
function notifierTestRecorderAdd(): THREE.Object3D[] {
  const notified: THREE.Object3D[] = [];
  unsubscribers.push(DisplacementSurfaceChangeNotifier.listenerAdd((solidRoot) => notified.push(solidRoot)));
  return notified;
}

/** Displacement surface change notifications from the surface presentation. */
describe('DisplacementSurfaceChangeNotifier', () => {
  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  it('reports the solid root when surfaces are created, rebuilt and removed', () => {
    const rig = displacementTestRigCreate('NotifierRig');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 3, 2), new THREE.Vector3(-4, 1, 0));
    const notified = notifierTestRecorderAdd();
    rig.model.rebuild(true);
    expect(notified).toHaveLength(0);
    displacementTestCreate(
      rig,
      displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 0, 1))),
      2,
    );
    expect(notified.length).toBeGreaterThan(0);
    expect(notified.every((solidRoot) => solidRoot === rig.model.root)).toBe(true);
    const afterCreate = notified.length;
    rig.commandStack.undo();
    expect(notified.length).toBeGreaterThan(afterCreate);
  });

  it('stops reporting after unsubscribing', () => {
    const notified: THREE.Object3D[] = [];
    const unsubscribe = DisplacementSurfaceChangeNotifier.listenerAdd((solidRoot) => notified.push(solidRoot));
    unsubscribe();
    DisplacementSurfaceChangeNotifier.notify(new THREE.Group());
    expect(notified).toHaveLength(0);
  });
});
