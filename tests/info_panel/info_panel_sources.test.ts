import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InfoPanelSources } from '@/info_panel/info_panel_sources.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ISSUES_SCHEDULER_DELAY_MILLISECONDS } from '@/info_panel/issues/issues_scheduler.js';
import { issuesTestSolidModelAdd, issuesTestWorldCreate } from './issues/issues_test_world.js';

/**
 * Unit tests for the info panel sources: the views they create show the log and
 * the issues, and history changes revalidate the map after the quiet time.
 */
describe('InfoPanelSources', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    ConsoleLog.resetForTests();
  });

  it('revalidates the map after a history change and shows the issues in its view', () => {
    const testWorld = issuesTestWorldCreate();
    const sources = new InfoPanelSources({ worldGroup: testWorld.world, commandStack: testWorld.commandStack });
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS);
    expect(sources.issuesScheduler.issuesRead()).toEqual([]);
    const view = sources.issuesViewCreate(() => undefined);
    const { model } = issuesTestSolidModelAdd(testWorld, 'Empty', false);
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS);
    expect(sources.issuesScheduler.issuesRead().map((issue) => issue.objectUuid)).toEqual([model.root.uuid]);
    expect(view.getElement().querySelectorAll('tr.editor-issues-row').length).toBe(1);
    view.dispose();
    sources.dispose();
  });

  it('creates a console view of the shared log by default', () => {
    const testWorld = issuesTestWorldCreate();
    const sources = new InfoPanelSources({ worldGroup: testWorld.world, commandStack: testWorld.commandStack });
    expect(sources.consoleLog).toBe(ConsoleLog.shared());
    const view = sources.consoleViewCreate();
    sources.consoleLog.entryAppendInfo('hello');
    expect(view.linesElementRead().textContent).toContain('hello');
    view.dispose();
    sources.dispose();
  });

  it('stops revalidating once disposed', () => {
    const testWorld = issuesTestWorldCreate();
    const sources = new InfoPanelSources({ worldGroup: testWorld.world, commandStack: testWorld.commandStack });
    sources.dispose();
    issuesTestSolidModelAdd(testWorld, 'Empty', false);
    vi.advanceTimersByTime(ISSUES_SCHEDULER_DELAY_MILLISECONDS * 2);
    expect(sources.issuesScheduler.issuesRead()).toEqual([]);
  });
});
