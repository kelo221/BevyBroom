import { describe, expect, it } from 'vitest';
import { PREVIEW_STATUS_INTERVAL_MILLISECONDS } from '@/preview/link/preview_link_status_channel.js';
import { PREVIEW_METHOD, PREVIEW_PROTOCOL_VERSION } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewLinkTransportFake } from '../preview_link_transport_fake.js';
import {
  previewLinkRigCreate,
  previewLinkRigGeometrySettle,
  previewLinkRigTick,
  type PreviewLinkRig,
} from '../preview_link_controller_rig.js';

/**
 * Counts every scene publication the fake game received.
 *
 * @param transport Fake transport.
 * @returns State and geometry calls together.
 */
function publicationCount(transport: PreviewLinkTransportFake): number {
  return transport.callsOf(PREVIEW_METHOD.applyState).length + transport.callsOf(PREVIEW_METHOD.publishGeometry).length;
}

/**
 * Connects a rig and lets it run long enough to publish everything it would.
 *
 * @param rig Controller rig.
 */
async function rigRunUntilSettled(rig: PreviewLinkRig): Promise<void> {
  await previewLinkRigTick(rig, 0);
  await previewLinkRigGeometrySettle(rig);
}

/**
 * The preview link checks every game process with the handshake and publishes
 * nothing into a game that fails it.
 */
describe('PreviewLinkController handshake', () => {
  it('connects and publishes after a compatible handshake', async () => {
    const rig = previewLinkRigCreate();
    await rigRunUntilSettled(rig);
    expect(rig.controller.connectionStateRead()).toBe('connected');
    expect(rig.transport.callsOf(PREVIEW_METHOD.hello)).toHaveLength(1);
    expect(rig.controller.gameHelloRead()?.project_id).toBe(rig.transport.projectIdentifier);
    expect(publicationCount(rig.transport)).toBeGreaterThan(0);
  });

  it('refuses a game that only speaks a newer protocol and explains why', async () => {
    const newer = PREVIEW_PROTOCOL_VERSION + 1;
    const rig = previewLinkRigCreate((transport) => {
      transport.helloProtocolRange = [newer, newer];
    });
    await rigRunUntilSettled(rig);
    expect(rig.controller.connectionStateRead()).toBe('incompatible');
    expect(rig.controller.lastErrorRead()).toContain(String(newer));
    expect(publicationCount(rig.transport)).toBe(0);
  });

  it('refuses a bridge without the handshake method', async () => {
    const rig = previewLinkRigCreate((transport) => {
      transport.isHelloSupported = false;
    });
    await rigRunUntilSettled(rig);
    expect(rig.controller.connectionStateRead()).toBe('incompatible');
    expect(rig.controller.lastErrorRead()).toContain('handshake');
    expect(publicationCount(rig.transport)).toBe(0);
  });

  it('refuses a game that lacks a required capability', async () => {
    const rig = previewLinkRigCreate((transport) => {
      transport.helloCapabilities = transport.helloCapabilities.filter((name) => name !== 'geometry');
    });
    await rigRunUntilSettled(rig);
    expect(rig.controller.connectionStateRead()).toBe('incompatible');
    expect(rig.controller.lastErrorRead()).toContain('geometry');
  });

  it('refuses a game of another project than the document expects', async () => {
    const rig = previewLinkRigCreate();
    rig.project.expected = `${rig.transport.projectIdentifier}-other`;
    await rigRunUntilSettled(rig);
    expect(rig.controller.connectionStateRead()).toBe('incompatible');
    expect(rig.controller.lastErrorRead()).toContain(rig.project.expected);
    expect(publicationCount(rig.transport)).toBe(0);
  });

  it('checks a restarted game again and recovers once a compatible game answers', async () => {
    const newer = PREVIEW_PROTOCOL_VERSION + 1;
    const rig = previewLinkRigCreate((transport) => {
      transport.helloProtocolRange = [newer, newer];
    });
    await rigRunUntilSettled(rig);
    expect(rig.controller.connectionStateRead()).toBe('incompatible');
    rig.transport.helloProtocolRange = [PREVIEW_PROTOCOL_VERSION, PREVIEW_PROTOCOL_VERSION];
    rig.transport.instanceIdentifier = `${rig.transport.instanceIdentifier}-restarted`;
    await previewLinkRigTick(rig, PREVIEW_STATUS_INTERVAL_MILLISECONDS);
    await previewLinkRigGeometrySettle(rig);
    expect(rig.controller.connectionStateRead()).toBe('connected');
    expect(rig.controller.lastErrorRead()).toBe('');
    expect(publicationCount(rig.transport)).toBeGreaterThan(0);
  });
});
