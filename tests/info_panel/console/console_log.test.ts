import { afterEach, describe, expect, it } from 'vitest';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { ConsoleLogChange } from '@/info_panel/console/console_log_entry.js';

/**
 * Unit tests for the console log store: writing lines with level and time,
 * capping to the newest lines, clearing, change listeners and the shared log.
 */
describe('ConsoleLog', () => {
  afterEach(() => {
    ConsoleLog.resetForTests();
  });

  it('keeps written lines in order with their level, text and clock time', () => {
    const clock = { now: 1000 + Math.random() * 1000 };
    const log = new ConsoleLog(10, () => clock.now);
    log.entryAppendInfo('first');
    const warningTime = clock.now + 5;
    clock.now = warningTime;
    log.entryAppendWarning('second');
    log.entryAppendError('third');
    const entries = log.entriesRead();
    expect(entries.map((entry) => entry.level)).toEqual(['info', 'warning', 'error']);
    expect(entries.map((entry) => entry.text)).toEqual(['first', 'second', 'third']);
    expect(entries[1]?.timestampMilliseconds).toBe(warningTime);
    expect(new Set(entries.map((entry) => entry.sequence)).size).toBe(3);
  });

  it('drops the oldest lines beyond the capacity and reports how many were dropped', () => {
    const capacity = 3 + Math.floor(Math.random() * 5);
    const log = new ConsoleLog(capacity);
    const changes: ConsoleLogChange[] = [];
    log.changeListenerAdd((change) => changes.push(change));
    const writtenCount = capacity + 2;
    for (let index = 0; index < writtenCount; index += 1) {
      log.entryAppendInfo(`line ${index}`);
    }
    expect(log.entriesRead().length).toBe(capacity);
    expect(log.entriesRead()[0]?.text).toBe(`line ${writtenCount - capacity}`);
    const dropped = changes.map((change) => (change.kind === 'append' ? change.droppedCount : 0));
    expect(dropped.reduce((sum, count) => sum + count, 0)).toBe(writtenCount - capacity);
  });

  it('caps the default log to 1000 lines', () => {
    const log = new ConsoleLog();
    for (let index = 0; index < 1005; index += 1) {
      log.entryAppendInfo(`line ${index}`);
    }
    expect(log.entriesRead().length).toBe(1000);
    expect(log.entriesRead().at(-1)?.text).toBe('line 1004');
  });

  it('returns only the newest lines when a limit is asked for', () => {
    const log = new ConsoleLog(50);
    ['a', 'b', 'c', 'd'].forEach((text) => log.entryAppendInfo(text));
    expect(log.entriesRecentRead(2).map((entry) => entry.text)).toEqual(['c', 'd']);
    expect(log.entriesRecentRead(0)).toEqual([]);
    expect(log.entriesRecentRead(99).length).toBe(4);
  });

  it('clears every line and tells listeners until they are removed', () => {
    const log = new ConsoleLog(10);
    const changes: ConsoleLogChange[] = [];
    const remove = log.changeListenerAdd((change) => changes.push(change));
    log.entryAppendError('broken');
    log.clear();
    expect(log.entriesRead()).toEqual([]);
    expect(changes.map((change) => change.kind)).toEqual(['append', 'clear']);
    remove();
    log.entryAppendInfo('after removal');
    expect(changes.length).toBe(2);
  });

  it('shares one log until it is reset for tests', () => {
    const shared = ConsoleLog.shared();
    shared.entryAppendInfo('kept');
    expect(ConsoleLog.shared()).toBe(shared);
    ConsoleLog.resetForTests();
    expect(ConsoleLog.shared()).not.toBe(shared);
    expect(ConsoleLog.shared().entriesRead()).toEqual([]);
  });
});
