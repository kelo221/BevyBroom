import { afterEach, describe, expect, it } from 'vitest';
import { Theme } from '@/theme.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ConsoleLogForwarder } from '@/info_panel/console/console_log_forwarder.js';

/**
 * Builds a status bar writing into a private console log.
 *
 * @returns The status bar and the log.
 */
function statusBarRigCreate(): { statusBar: StatusBar; log: ConsoleLog } {
  const log = new ConsoleLog(100);
  const forwarder = new ConsoleLogForwarder({ logResolve: () => log, clock: () => 0 });
  const statusBar = new StatusBar(document.createElement('div'), Theme, forwarder);
  return { statusBar, log };
}

/**
 * Unit tests for the status bar writing its action and error messages to the
 * console log while live feedback stays out of it.
 */
describe('StatusBar console forwarding', () => {
  afterEach(() => {
    ConsoleLog.resetForTests();
  });

  it('writes actions as info lines and errors as error lines', () => {
    const { statusBar, log } = statusBarRigCreate();
    statusBar.setLastAction('Created Box');
    statusBar.setErrorText('Could not save');
    expect(log.entriesRead().map((entry) => [entry.level, entry.text])).toEqual([
      ['info', 'Created Box'],
      ['error', 'Could not save'],
    ]);
    statusBar.dispose();
  });

  it('writes a message set again and again by a refresh loop only once', () => {
    const { statusBar, log } = statusBarRigCreate();
    for (let frame = 0; frame < 10; frame += 1) {
      statusBar.setLastAction('Edit Mode');
    }
    expect(log.entriesRead().length).toBe(1);
    statusBar.dispose();
  });

  it('shows live feedback and fit feedback without writing them', () => {
    const { statusBar, log } = statusBarRigCreate();
    statusBar.setLastActionTransient('ΔX 1.25');
    statusBar.setFitFeedback('Fit 3 objects');
    expect(statusBar.getRootElement().textContent).toContain('ΔX 1.25');
    expect(log.entriesRead()).toEqual([]);
    statusBar.dispose();
  });

  it('writes to the shared console log by default', () => {
    const statusBar = new StatusBar(document.createElement('div'), Theme);
    const text = `Shared ${Math.random()}`;
    statusBar.setLastAction(text);
    expect(
      ConsoleLog.shared()
        .entriesRead()
        .map((entry) => entry.text),
    ).toContain(text);
    statusBar.dispose();
  });
});
