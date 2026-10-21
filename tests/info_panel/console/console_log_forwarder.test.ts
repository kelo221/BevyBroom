import { describe, expect, it } from 'vitest';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import {
  CONSOLE_LOG_FORWARDER_REPEAT_QUIET_MILLISECONDS,
  ConsoleLogForwarder,
} from '@/info_panel/console/console_log_forwarder.js';

/**
 * Builds a forwarder writing into a private log with a manual clock.
 *
 * @returns The log, the clock and the forwarder.
 */
function forwarderRigCreate(): { log: ConsoleLog; clock: { now: number }; forwarder: ConsoleLogForwarder } {
  const log = new ConsoleLog(100);
  const clock = { now: Math.random() * 10000 };
  const forwarder = new ConsoleLogForwarder({ logResolve: () => log, clock: () => clock.now });
  return { log, clock, forwarder };
}

/**
 * Unit tests for the console log forwarder that writes status messages without
 * flooding the log with refresh-loop repeats.
 */
describe('ConsoleLogForwarder', () => {
  it('writes each distinct message once with its level and skips blank messages', () => {
    const { log, forwarder } = forwarderRigCreate();
    forwarder.messageForward('info', 'Created Box');
    forwarder.messageForward('info', '   ');
    forwarder.messageForward('error', 'Could not load');
    expect(log.entriesRead().map((entry) => [entry.level, entry.text])).toEqual([
      ['info', 'Created Box'],
      ['error', 'Could not load'],
    ]);
  });

  it('writes a message that keeps repeating without a pause only once', () => {
    const { log, clock, forwarder } = forwarderRigCreate();
    const stepMilliseconds = CONSOLE_LOG_FORWARDER_REPEAT_QUIET_MILLISECONDS / 4;
    for (let frame = 0; frame < 20; frame += 1) {
      forwarder.messageForward('info', 'Edit Mode');
      clock.now += stepMilliseconds;
    }
    expect(log.entriesRead().length).toBe(1);
  });

  it('writes the same message again after a quiet pause or another message', () => {
    const { log, clock, forwarder } = forwarderRigCreate();
    forwarder.messageForward('info', 'Saved');
    clock.now += CONSOLE_LOG_FORWARDER_REPEAT_QUIET_MILLISECONDS + 1;
    forwarder.messageForward('info', 'Saved');
    forwarder.messageForward('info', 'Other');
    forwarder.messageForward('info', 'Saved');
    expect(log.entriesRead().map((entry) => entry.text)).toEqual(['Saved', 'Saved', 'Other', 'Saved']);
  });

  it('treats the same text with another level as a new message', () => {
    const { log, forwarder } = forwarderRigCreate();
    forwarder.messageForward('info', 'Port busy');
    forwarder.messageForward('error', 'Port busy');
    expect(log.entriesRead().map((entry) => entry.level)).toEqual(['info', 'error']);
  });
});
