import * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PREVIEW_GEOMETRY_SETTLE_MILLISECONDS } from '@/preview/link/preview_link_geometry_channel.js';
import { PreviewLinkTransportFake } from './preview_link_transport_fake.js';

/** A controller wired to a fake game with a manual clock. */
export interface PreviewLinkRig {
  world: THREE.Group;
  transport: PreviewLinkTransportFake;
  controller: PreviewLinkController;
  clock: { now: number };
  edit: { inProgress: boolean };
  level: { name: string };
  project: { expected: string | null };
}

/**
 * Builds a connecting controller rig around a one-box world.
 *
 * @param prepareTransport Adjusts the fake game before the controller is built.
 * @returns The rig.
 */
export function previewLinkRigCreate(
  prepareTransport: (transport: PreviewLinkTransportFake) => void = () => {},
): PreviewLinkRig {
  const world = new THREE.Group();
  world.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()));
  const transport = new PreviewLinkTransportFake();
  prepareTransport(transport);
  const clock = { now: 1000 };
  const edit = { inProgress: false };
  const level = { name: 'test_level' };
  const project: { expected: string | null } = { expected: null };
  const controller = new PreviewLinkController({
    worldGroup: world,
    transport,
    geometryEncoder: async () => 'Z2xURg==',
    onCatalogLoaded: () => {},
    clock: () => clock.now,
    isEditInProgress: () => edit.inProgress,
    levelNameProvider: () => level.name,
    expectedProjectProvider: () => project.expected,
  });
  controller.connect();
  return { world, transport, controller, clock, edit, level, project };
}

/**
 * Runs one tick and waits for every request it started.
 *
 * @param rig Controller rig.
 * @param advanceMilliseconds Time to advance before the tick.
 */
export async function previewLinkRigTick(rig: PreviewLinkRig, advanceMilliseconds: number): Promise<void> {
  rig.clock.now += advanceMilliseconds;
  await Promise.all(rig.controller.tick());
}

/**
 * Ticks long enough for the current geometry to be observed and then published.
 *
 * @param rig Controller rig.
 */
export async function previewLinkRigGeometrySettle(rig: PreviewLinkRig): Promise<void> {
  await previewLinkRigTick(rig, PREVIEW_GEOMETRY_SETTLE_MILLISECONDS);
  await previewLinkRigTick(rig, PREVIEW_GEOMETRY_SETTLE_MILLISECONDS);
}
