import { describe, expect, it } from 'vitest';
import { GameProcessNoticeCollector } from '@/desktop/bun/game_process/game_process_notice_collector.js';

/** The collector turns a game's `warning:` and `error:` lines into notices. */
describe('GameProcessNoticeCollector', () => {
  it('keeps warning and error lines without colour codes, once each', () => {
    const collector = new GameProcessNoticeCollector();
    const warningText = 'a prop is left out';
    collector.lineAdd(`warning: ${warningText}`);
    collector.lineAdd(`warning: ${warningText}`);
    collector.lineAdd('\u001b[1;31merror: the level is broken\u001b[0m');
    collector.lineAdd('INFO something ordinary');
    expect(collector.noticesRead()).toEqual([
      { severity: 'warning', message: warningText, file: '', line: 0, column: 0 },
      { severity: 'error', message: 'the level is broken', file: '', line: 0, column: 0 },
    ]);
  });

  it('drops compiler warnings printed before cargo hands over to the game', () => {
    const collector = new GameProcessNoticeCollector();
    collector.lineAdd('warning: unused import: `compilerOnly`');
    collector.lineAdd('    Finished `dev` profile');
    collector.lineAdd('     Running `target/debug/game`');
    expect(collector.noticesRead()).toEqual([]);
    collector.lineAdd('warning: from the game');
    expect(collector.noticesRead().map((notice) => notice.message)).toEqual(['from the game']);
  });

  it('forgets every notice when cleared', () => {
    const collector = new GameProcessNoticeCollector();
    collector.lineAdd('error: first run');
    collector.clear();
    expect(collector.noticesRead()).toEqual([]);
  });
});
