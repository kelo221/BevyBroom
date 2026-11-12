import { describe, expect, it } from 'vitest';
import { LevelBrowser } from '@/level_browser/ui/level_browser.js';
import { LEVEL_BROWSER_ROW_DOCUMENT_ATTRIBUTE } from '@/level_browser/ui/level_browser_list.js';
import { GameProcessControlUnavailable } from '@/project/control/game_process_control.js';
import { ProjectLevelService } from '@/project/level/project_level_service.js';
import {
  PROJECT_LEVEL_TEST_PROJECT_FILE,
  projectLevelActionsRigCreate,
  projectLevelRigProjectOpen,
  projectLevelTestPortalNamesRead,
  projectLevelTestSceneTextBuild,
} from '../../project/level/project_level_test_support.js';
import { workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';

/**
 * Reads the documents of the rows a browser shows, in display order.
 *
 * @param browser Level browser.
 * @returns Row documents.
 */
function rowDocumentsRead(browser: LevelBrowser): string[] {
  return Array.from(
    browser.listElementRead().querySelectorAll<HTMLElement>(`[${LEVEL_BROWSER_ROW_DOCUMENT_ATTRIBUTE}]`),
  ).map((row) => row.getAttribute(LEVEL_BROWSER_ROW_DOCUMENT_ATTRIBUTE) ?? '');
}

/**
 * Returns the row element of a document.
 *
 * @param browser Level browser.
 * @param document Document of the row.
 * @returns Row element.
 */
function rowElementRead(browser: LevelBrowser, document: string): HTMLElement {
  const row = browser
    .listElementRead()
    .querySelector<HTMLElement>(`[${LEVEL_BROWSER_ROW_DOCUMENT_ATTRIBUTE}="${document}"]`);
  if (row === null) {
    throw new Error(`No row for ${document}`);
  }
  return row;
}

/**
 * Finds a button of the browser by its text.
 *
 * @param browser Level browser.
 * @param text Button text.
 * @returns Button element.
 */
function buttonRead(browser: LevelBrowser, text: string): HTMLButtonElement {
  const button = Array.from(browser.getElement().querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );
  if (button === undefined) {
    throw new Error(`No button ${text}`);
  }
  return button;
}

/**
 * Waits until queued promise callbacks ran.
 *
 * @returns Promise settling after a macrotask.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The Level Browser lists project levels and runs the level actions. */
describe('LevelBrowser', () => {
  it('explains that project levels need the desktop app when the control is unavailable', () => {
    const rig = projectLevelActionsRigCreate();
    const service = new ProjectLevelService({ workbench: rig.workbench, control: new GameProcessControlUnavailable() });
    rig.context.serviceRead = () => service;
    const browser = new LevelBrowser({ actions: rig.actions });
    expect(browser.getElement().textContent).toContain('desktop app');
    expect(buttonRead(browser, 'New Level').disabled).toBe(true);
    browser.dispose();
    service.dispose();
  });

  it('lists the levels with modified time, marks the open one and filters by the search text', async () => {
    const rig = projectLevelActionsRigCreate();
    rig.control
      .projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE)
      .set('hall.json', '{"version":1,"objects":[]}');
    rig.control
      .projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE)
      .set('pit.json', '{"version":1,"objects":[]}');
    const browser = new LevelBrowser({ actions: rig.actions });
    expect(browser.getElement().textContent).toContain('Open a game project');
    await projectLevelRigProjectOpen(rig);
    expect(rowDocumentsRead(browser)).toEqual(['hall.json', 'pit.json']);
    expect(browser.getElement().textContent).toContain('2 levels');
    await rig.actions.levelOpen('pit.json', false);
    expect(rowElementRead(browser, 'pit.json').textContent).toContain('(open)');
    expect(rowElementRead(browser, 'hall.json').textContent).not.toContain('(open)');
    expect(rowElementRead(browser, 'hall.json').textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    const search = browser.getElement().querySelector<HTMLInputElement>('input[aria-label="Search levels"]');
    search?.setRangeText('hall', 0, 0, 'end');
    search?.dispatchEvent(new Event('input'));
    expect(rowDocumentsRead(browser)).toEqual(['hall.json']);
    browser.dispose();
  });

  it('opens a level on double-click and saves, creates and renames levels from the name field, asking before New Level discards work', async () => {
    const source = projectLevelActionsRigCreate();
    const text = projectLevelTestSceneTextBuild(source.context.sceneIOHandler, source.context.worldObject, 'Gate');
    const rig = projectLevelActionsRigCreate();
    rig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE).set('hall.json', text);
    await projectLevelRigProjectOpen(rig);
    const browser = new LevelBrowser({ actions: rig.actions });
    rowElementRead(browser, 'hall.json').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();
    expect(projectLevelTestPortalNamesRead(rig.context.worldObject)).toEqual(['Gate']);
    expect(rig.service.openLevelRead()?.document).toBe('hall.json');
    browser.nameInputRead().value = 'Copy Of Hall';
    buttonRead(browser, 'Save As New').click();
    await settle();
    expect(rowDocumentsRead(browser)).toEqual(['copy_of_hall.json', 'hall.json']);
    rowElementRead(browser, 'copy_of_hall.json').click();
    expect(browser.nameInputRead().value).toBe('copy_of_hall');
    browser.nameInputRead().value = 'Renamed Hall';
    buttonRead(browser, 'Rename').click();
    await settle();
    expect(rowDocumentsRead(browser)).toEqual(['hall.json', 'renamed_hall.json']);
    expect(rig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE).get('renamed_hall.json')).toContain(
      'Gate',
    );
    browser.nameInputRead().value = 'Empty Arena';
    buttonRead(browser, 'New Level').click();
    await settle();
    expect(rowDocumentsRead(browser)).toEqual(['hall.json', 'renamed_hall.json']);
    rig.context.toolbarContainer.querySelector<HTMLButtonElement>('[data-message-box-accept="true"]')?.click();
    await settle();
    expect(rowDocumentsRead(browser)).toContain('empty_arena.json');
    expect(projectLevelTestPortalNamesRead(rig.context.worldObject)).toEqual([]);
    browser.dispose();
  });

  it('keeps a browser over a bare workbench rig quiet when no project is open', () => {
    const rig = projectLevelActionsRigCreate(workbenchRigCreate().worldGroup);
    const browser = new LevelBrowser({ actions: rig.actions });
    expect(rowDocumentsRead(browser)).toEqual([]);
    expect(buttonRead(browser, 'Open').disabled).toBe(true);
    browser.dispose();
  });
});
