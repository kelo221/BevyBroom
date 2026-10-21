import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PreviewLinkConsoleReporter } from '@/preview/link/preview_link_console_reporter.js';
import { PREVIEW_STATUS_INTERVAL_MILLISECONDS } from '@/preview/link/preview_link_status_channel.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { PreviewLinkTransportFake } from './preview_link_transport_fake.js';

/**
 * A controller with a fake game, a manual clock and a reporter into a private
 * log.
 */
interface ReporterRig {
  transport: PreviewLinkTransportFake;
  controller: PreviewLinkController;
  clock: { now: number };
  log: ConsoleLog;
  reporter: PreviewLinkConsoleReporter;
}

const ENDPOINT = 'http://127.0.0.1:15702';

/**
 * Builds a disconnected controller watched by a reporter.
 *
 * @returns The rig.
 */
function rigCreate(): ReporterRig {
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
  const reporter = new PreviewLinkConsoleReporter(controller, ENDPOINT, () => log);
  return { transport, controller, clock, log, reporter };
}

/**
 * Advances past the status poll interval, ticks and waits for the requests.
 *
 * @param rig Reporter rig.
 */
async function pollAndSettle(rig: ReporterRig): Promise<void> {
  rig.clock.now += PREVIEW_STATUS_INTERVAL_MILLISECONDS + 1;
  await Promise.all(rig.controller.tick());
}

/**
 * Returns the logged lines as level and text pairs.
 *
 * @param log Console log.
 * @returns Pairs in order.
 */
function linesRead(log: ConsoleLog): Array<[string, string]> {
  return log.entriesRead().map((entry) => [entry.level, entry.text]);
}

/**
 * Unit tests for the preview link console reporter: it logs connection changes
 * and new errors once, never every poll.
 */
describe('PreviewLinkConsoleReporter', () => {
  it('logs connecting and connected once however often the game is polled', async () => {
    const rig = rigCreate();
    rig.controller.connect();
    for (let poll = 0; poll < 4; poll += 1) {
      await pollAndSettle(rig);
    }
    expect(rig.controller.connectionStateRead()).toBe('connected');
    expect(linesRead(rig.log)).toEqual([
      ['info', `Game preview connecting to ${ENDPOINT}`],
      ['info', `Game preview connected to ${ENDPOINT}`],
    ]);
  });

  it('logs an unreachable game once with its reason and the reconnection', async () => {
    const rig = rigCreate();
    rig.controller.connect();
    await pollAndSettle(rig);
    rig.transport.isReachable = false;
    for (let poll = 0; poll < 3; poll += 1) {
      await pollAndSettle(rig);
    }
    rig.transport.isReachable = true;
    await pollAndSettle(rig);
    const levels = linesRead(rig.log).map(([level]) => level);
    expect(levels).toEqual(['info', 'info', 'warning', 'info']);
    expect(rig.log.entriesRead()[2]?.text).toContain(rig.controller.lastErrorRead() || 'offline');
  });

  it('logs a new request error of a reachable game as an error', () => {
    const rig = rigCreate();
    rig.controller.connect();
    rig.controller.onRequestSucceeded();
    rig.controller.onRequestFailed('geometry rejected', false);
    rig.controller.onRequestFailed('geometry rejected', false);
    expect(linesRead(rig.log).at(-1)).toEqual(['error', 'Game preview error: geometry rejected']);
    expect(linesRead(rig.log).filter(([level]) => level === 'error').length).toBe(1);
  });

  it('logs the disconnect and nothing after it is disposed', () => {
    const rig = rigCreate();
    rig.controller.connect();
    rig.controller.disconnect();
    expect(linesRead(rig.log).at(-1)).toEqual(['info', 'Game preview disconnected']);
    const countBefore = rig.log.entriesRead().length;
    rig.reporter.dispose();
    rig.controller.connect();
    expect(rig.log.entriesRead().length).toBe(countBefore);
  });
});
