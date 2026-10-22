import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PREVIEW_GEOMETRY_SETTLE_MILLISECONDS } from '@/preview/link/preview_link_geometry_channel.js';
import { PREVIEW_STATUS_INTERVAL_MILLISECONDS } from '@/preview/link/preview_link_status_channel.js';
import { PREVIEW_METHOD, type PreviewAuthoredState } from '@/preview/protocol/preview_protocol_types.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { documentIdentityEnsure, documentIdentityReset } from '@/io/document/document_identity.js';
import type { PreviewLinkTransportFake } from './preview_link_transport_fake.js';
import {
  previewLinkRigCreate as createRig,
  previewLinkRigGeometrySettle as geometrySettle,
  previewLinkRigTick as tickAndSettle,
} from './preview_link_controller_rig.js';

/**
 * Returns the newest state the fake game received.
 *
 * @param transport Fake transport.
 * @returns Newest state.
 */
function latestState(transport: PreviewLinkTransportFake): PreviewAuthoredState {
  const calls = transport.callsOf(PREVIEW_METHOD.applyState);
  const latest = calls[calls.length - 1];
  if (!latest) throw new Error('no state sent');
  return latest.params as PreviewAuthoredState;
}

/**
 * Returns the geometry revisions the fake game received, in order.
 *
 * @param transport Fake transport.
 * @returns Published geometry revisions.
 */
function publishedGeometryRevisions(transport: PreviewLinkTransportFake): number[] {
  const publications = transport.callsOf(PREVIEW_METHOD.publishGeometry);
  return publications.map((call) => (call.params as { geometry_revision: number }).geometry_revision);
}

/**
 * The preview link mirrors edits into the game with revisions, debounced
 * geometry and restart recovery.
 */
describe('PreviewLinkController', () => {
  it('connects on the first status reply and then sends the authored state with increasing revisions', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    expect(rig.controller.connectionStateRead()).toBe('connected');
    await tickAndSettle(rig, 33);
    const first = latestState(rig.transport);
    expect(first.project_id).toBe('project-test');
    expect(first.objects).toHaveLength(1);
    rig.world.children[0]?.position.set(3, 0, 0);
    await tickAndSettle(rig, 33);
    const second = latestState(rig.transport);
    expect(second.revision).toBeGreaterThan(first.revision);
    expect(second.session_id).toBe(first.session_id);
    expect(second.objects[0]?.translation[0]).toBe(3);
  });

  it('does not resend an unchanged state', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    await tickAndSettle(rig, 33);
    const sentCount = rig.transport.callsOf(PREVIEW_METHOD.applyState).length;
    await tickAndSettle(rig, 33);
    await tickAndSettle(rig, 33);
    expect(rig.transport.callsOf(PREVIEW_METHOD.applyState)).toHaveLength(sentCount);
  });

  it('publishes geometry only after it settles and no edit is in progress', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    rig.edit.inProgress = true;
    await tickAndSettle(rig, PREVIEW_GEOMETRY_SETTLE_MILLISECONDS * 3);
    expect(rig.transport.callsOf(PREVIEW_METHOD.publishGeometry)).toHaveLength(0);
    rig.edit.inProgress = false;
    await tickAndSettle(rig, PREVIEW_GEOMETRY_SETTLE_MILLISECONDS);
    expect(rig.transport.callsOf(PREVIEW_METHOD.publishGeometry)).toHaveLength(1);
    await tickAndSettle(rig, PREVIEW_GEOMETRY_SETTLE_MILLISECONDS * 2);
    expect(rig.transport.callsOf(PREVIEW_METHOD.publishGeometry)).toHaveLength(1);
  });

  it('publishes again after a geometry edit with a newer geometry revision', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    await geometrySettle(rig);
    rig.world.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    await geometrySettle(rig);
    const publications = rig.transport.callsOf(PREVIEW_METHOD.publishGeometry);
    expect(publications).toHaveLength(2);
    const revisions = publications.map((call) => (call.params as { geometry_revision: number }).geometry_revision);
    expect(revisions[1]).toBeGreaterThan(revisions[0] ?? Infinity);
  });

  it('sends light moves as state without republishing geometry', async () => {
    const rig = createRig();
    const light = LightOwner.createDefault('Lamp', 'point');
    rig.world.add(light);
    await tickAndSettle(rig, 0);
    await geometrySettle(rig);
    const publicationCount = rig.transport.callsOf(PREVIEW_METHOD.publishGeometry).length;
    expect(publicationCount).toBe(1);
    light.position.set(0, 4, 0);
    await geometrySettle(rig);
    const lightObject = latestState(rig.transport).objects.find((object) => object.id === light.uuid);
    expect(lightObject?.light?.light_type).toBe('point');
    expect(lightObject?.translation[1]).toBe(4);
    expect(rig.transport.callsOf(PREVIEW_METHOD.publishGeometry)).toHaveLength(publicationCount);
  });

  it('resends state and geometry when the game restarts', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    await geometrySettle(rig);
    const stateCount = rig.transport.callsOf(PREVIEW_METHOD.applyState).length;
    rig.transport.instanceIdentifier = 'game-instance-b';
    rig.transport.highestStateRevision = 0;
    await tickAndSettle(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS);
    await geometrySettle(rig);
    expect(rig.transport.callsOf(PREVIEW_METHOD.applyState).length).toBeGreaterThan(stateCount);
    expect(rig.transport.callsOf(PREVIEW_METHOD.publishGeometry)).toHaveLength(2);
  });

  it('republishes once under a new revision when the game fails to load the geometry', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    await geometrySettle(rig);
    const firstRevision = publishedGeometryRevisions(rig.transport)[0] ?? 0;
    rig.transport.failedGeometryRevision = firstRevision;
    await tickAndSettle(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS);
    await geometrySettle(rig);
    const retried = publishedGeometryRevisions(rig.transport);
    expect(retried).toHaveLength(2);
    expect(retried[1]).toBeGreaterThan(firstRevision);
    rig.transport.failedGeometryRevision = retried[1] ?? 0;
    await tickAndSettle(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS);
    await geometrySettle(rig);
    expect(publishedGeometryRevisions(rig.transport)).toHaveLength(2);
    rig.world.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    await geometrySettle(rig);
    expect(publishedGeometryRevisions(rig.transport)).toHaveLength(3);
  });

  it('republishes unchanged geometry under the new level name when the level is renamed', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    await geometrySettle(rig);
    rig.level.name = `${rig.level.name}_renamed`;
    await geometrySettle(rig);
    const publications = rig.transport.callsOf(PREVIEW_METHOD.publishGeometry);
    expect(publications.map((call) => (call.params as { level_name: string }).level_name)).toEqual([
      'test_level',
      rig.level.name,
    ]);
  });

  it('republishes unchanged geometry for a new document', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    await geometrySettle(rig);
    const firstDocument = documentIdentityEnsure(rig.world);
    documentIdentityReset(rig.world);
    await geometrySettle(rig);
    const publications = rig.transport.callsOf(PREVIEW_METHOD.publishGeometry);
    expect(publications.map((call) => (call.params as { document_id: string }).document_id)).toEqual([
      firstDocument,
      documentIdentityEnsure(rig.world),
    ]);
  });

  it('reports an unreachable game and reconnects when it answers again', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    rig.transport.isReachable = false;
    await tickAndSettle(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS);
    expect(rig.controller.connectionStateRead()).toBe('unreachable');
    expect(rig.controller.lastErrorRead()).not.toBe('');
    rig.transport.isReachable = true;
    await tickAndSettle(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS);
    expect(rig.controller.connectionStateRead()).toBe('connected');
  });

  it('stops sending after disconnect', async () => {
    const rig = createRig();
    await tickAndSettle(rig, 0);
    rig.controller.disconnect();
    const callCount = rig.transport.calls.length;
    await tickAndSettle(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS * 2);
    expect(rig.transport.calls).toHaveLength(callCount);
  });
});
