import { afterEach, describe, expect, it } from 'vitest';
import { Theme } from '@/theme.js';
import { SHELL_INFO_PANEL_MIN_HEIGHT_PX } from '@/layout/shell/state/shell_state.js';
import { infoPanelStripRevealTabWrite } from '@/info_panel/strip/info_panel_strip_reveal.js';
import {
  shellTestDocksCreate,
  shellTestDocksDispose,
  shellTestInfoPanelTabButtonRead,
  shellTestStorageCreate,
  type ShellTestDocks,
} from '../shell_test_support.js';

/** Docks built by the running test. */
const shellInfoPanelCollapseTestDocks: ShellTestDocks[] = [];

/**
 * Builds docks over a storage and remembers them for cleanup.
 *
 * @param storage Storage the shell state is kept in.
 * @returns Docks with the info panel bound to the frame.
 */
function shellInfoPanelCollapseTestDocksCreate(storage: Storage = shellTestStorageCreate()): ShellTestDocks {
  const docks = shellTestDocksCreate(storage);
  shellInfoPanelCollapseTestDocks.push(docks);
  return docks;
}

/**
 * Returns the pixel height the frame gives the info panel.
 *
 * @param docks Docks holding the info panel.
 * @returns Height from the info panel pane's flex basis.
 */
function shellInfoPanelCollapseTestHeightRead(docks: ShellTestDocks): number {
  const flexBasis = /(\d+)px$/.exec(docks.frame.infoPanelHostRead().style.flex);
  return Number(flexBasis?.[1] ?? Number.NaN);
}

afterEach(() => {
  shellInfoPanelCollapseTestDocks.splice(0).forEach((docks) => shellTestDocksDispose(docks));
  document.body.replaceChildren();
});

describe('ShellInfoPanelCollapseBinding', () => {
  it('starts folded to the strip with the folded look on first run', () => {
    const docks = shellInfoPanelCollapseTestDocksCreate();
    expect(docks.frame.isInfoPanelCollapsed()).toBe(true);
    expect(docks.infoPanel.isCollapsedShown()).toBe(true);
    expect(shellInfoPanelCollapseTestHeightRead(docks)).toBe(Theme.infoStripHeightPx);
  });

  it('unfolds to the remembered height on a tab click and folds on a click of the shown tab', () => {
    const docks = shellInfoPanelCollapseTestDocksCreate();
    const rememberedHeightPx = SHELL_INFO_PANEL_MIN_HEIGHT_PX + 42;
    docks.stateStore.update({ infoPanelHeightPx: rememberedHeightPx });
    const rebuilt = shellInfoPanelCollapseTestDocksCreate(docks.storage);
    shellTestInfoPanelTabButtonRead(rebuilt.infoPanel, 'issues').click();
    expect(rebuilt.frame.isInfoPanelCollapsed()).toBe(false);
    expect(rebuilt.infoPanel.isCollapsedShown()).toBe(false);
    expect(rebuilt.infoPanel.activeTabIdRead()).toBe('issues');
    expect(shellInfoPanelCollapseTestHeightRead(rebuilt)).toBe(rememberedHeightPx);
    shellTestInfoPanelTabButtonRead(rebuilt.infoPanel, 'issues').click();
    expect(rebuilt.frame.isInfoPanelCollapsed()).toBe(true);
    expect(shellInfoPanelCollapseTestHeightRead(rebuilt)).toBe(Theme.infoStripHeightPx);
  });

  it('switches tabs of an unfolded panel without folding it', () => {
    const docks = shellInfoPanelCollapseTestDocksCreate();
    docks.frame.infoPanelCollapsedSet(false);
    docks.infoPanel.tabShow('console');
    shellTestInfoPanelTabButtonRead(docks.infoPanel, 'issues').click();
    expect(docks.frame.isInfoPanelCollapsed()).toBe(false);
    expect(docks.infoPanel.activeTabIdRead()).toBe('issues');
  });

  it('unfolds on the console tab when a revealing strip element is clicked', () => {
    const docks = shellInfoPanelCollapseTestDocksCreate();
    docks.infoPanel.tabShow('issues');
    const newestLine = document.createElement('span');
    infoPanelStripRevealTabWrite(newestLine, 'console');
    docks.infoPanel.stripSummarySlotRead().appendChild(newestLine);
    newestLine.click();
    expect(docks.frame.isInfoPanelCollapsed()).toBe(false);
    expect(docks.infoPanel.activeTabIdRead()).toBe('console');
  });

  it('restores the unfolded panel and its tab from the store in fresh docks', () => {
    const docks = shellInfoPanelCollapseTestDocksCreate();
    shellTestInfoPanelTabButtonRead(docks.infoPanel, 'issues').click();
    const restored = shellInfoPanelCollapseTestDocksCreate(docks.storage);
    expect(restored.frame.isInfoPanelCollapsed()).toBe(false);
    expect(restored.infoPanel.isCollapsedShown()).toBe(false);
    expect(restored.infoPanel.activeTabIdRead()).toBe('issues');
  });

  it('stops folding from strip clicks once the dock commands are disposed', () => {
    const docks = shellInfoPanelCollapseTestDocksCreate();
    docks.dockCommands.dispose();
    shellTestInfoPanelTabButtonRead(docks.infoPanel, 'issues').click();
    expect(docks.frame.isInfoPanelCollapsed()).toBe(true);
  });
});
