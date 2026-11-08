import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import {
  PREVIEW_OPTIONAL_CAPABILITY_NOTICES,
  PreviewLinkCapabilityNoticeReporter,
} from '@/preview/link/preview_link_capability_notice_reporter.js';
import { PREVIEW_STATUS_INTERVAL_MILLISECONDS } from '@/preview/link/preview_link_status_channel.js';
import { PREVIEW_CAPABILITY_LIGHTS } from '@/preview/protocol/preview_protocol_types.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { PreviewLinkTransportFake } from './preview_link_transport_fake.js';

/**
 * A controller with a fake game, a manual clock and a capability notice
 * reporter into a private log.
 */
interface NoticeRig {
  transport: PreviewLinkTransportFake;
  controller: PreviewLinkController;
  clock: { now: number };
  log: ConsoleLog;
  reporter: PreviewLinkCapabilityNoticeReporter;
}

/**
 * Builds a disconnected controller watched by a capability notice reporter.
 *
 * @returns The rig.
 */
function rigCreate(): NoticeRig {
  const transport = new PreviewLinkTransportFake();
  const clock = { now: 1000 };
  const controller = new PreviewLinkController({
    worldGroup: new THREE.Group(),
    transport,
    geometryEncoder: async () => 'Z2xURg==',
    onCatalogLoaded: () => {},
    clock: () => clock.now,
    isEditInProgress: () => false,
    levelNameProvider: () => 'level',
  });
  const log = new ConsoleLog(100);
  const reporter = new PreviewLinkCapabilityNoticeReporter(controller, () => log);
  return { transport, controller, clock, log, reporter };
}

/**
 * Advances past the status poll interval, ticks and waits for the requests,
 * several times.
 *
 * @param rig Notice rig.
 * @param pollCount How many polls to run.
 */
async function pollsSettle(rig: NoticeRig, pollCount: number): Promise<void> {
  for (let poll = 0; poll < pollCount; poll += 1) {
    rig.clock.now += PREVIEW_STATUS_INTERVAL_MILLISECONDS + 1;
    await Promise.all(rig.controller.tick());
  }
}

/**
 * Removes the lights capability from the fake game's handshake.
 *
 * @param transport Fake game bridge.
 */
function lightsCapabilityRemove(transport: PreviewLinkTransportFake): void {
  transport.helloCapabilities = transport.helloCapabilities.filter(
    (capability) => capability !== PREVIEW_CAPABILITY_LIGHTS,
  );
}

/**
 * Returns the logged warnings' texts.
 *
 * @param log Console log.
 * @returns Warning texts in order.
 */
function warningsRead(log: ConsoleLog): string[] {
  return log
    .entriesRead()
    .filter((entry) => entry.level === 'warning')
    .map((entry) => entry.text);
}

/**
 * Returns the notice text the reporter writes for a missing capability.
 *
 * @param capability Capability name.
 * @returns Notice text.
 */
function noticeOf(capability: string): string {
  const optional = PREVIEW_OPTIONAL_CAPABILITY_NOTICES.find((entry) => entry.capability === capability);
  expect(optional).toBeDefined();
  return optional?.notice ?? '';
}

/**
 * Unit tests for the capability notice reporter: a connected game without the
 * lights capability gets one notice per game process, a game with it none.
 */
describe('PreviewLinkCapabilityNoticeReporter', () => {
  it('notices once that a connected game does not render editor lights', async () => {
    const rig = rigCreate();
    lightsCapabilityRemove(rig.transport);
    rig.controller.connect();
    await pollsSettle(rig, 4);
    expect(rig.controller.connectionStateRead()).toBe('connected');
    expect(warningsRead(rig.log)).toEqual([noticeOf(PREVIEW_CAPABILITY_LIGHTS)]);
    expect(noticeOf(PREVIEW_CAPABILITY_LIGHTS)).toBe('This game does not render editor lights');
  });

  it('writes nothing for a game that renders lights', async () => {
    const rig = rigCreate();
    expect(rig.transport.helloCapabilities).toContain(PREVIEW_CAPABILITY_LIGHTS);
    rig.controller.connect();
    await pollsSettle(rig, 4);
    expect(rig.controller.connectionStateRead()).toBe('connected');
    expect(rig.log.entriesRead()).toEqual([]);
  });

  it('notices again for a restarted game process and nothing after it is disposed', async () => {
    const rig = rigCreate();
    lightsCapabilityRemove(rig.transport);
    rig.controller.connect();
    await pollsSettle(rig, 3);
    rig.transport.instanceIdentifier = `${rig.transport.instanceIdentifier}-restarted`;
    await pollsSettle(rig, 3);
    expect(warningsRead(rig.log).length).toBe(2);
    rig.reporter.dispose();
    rig.transport.instanceIdentifier = `${rig.transport.instanceIdentifier}-again`;
    await pollsSettle(rig, 3);
    expect(warningsRead(rig.log).length).toBe(2);
  });
});
