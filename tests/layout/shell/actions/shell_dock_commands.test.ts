import { afterEach, describe, expect, it } from 'vitest';
import type { ShellInspectorTabId } from '@/layout/shell/inspector/shell_inspector.js';
import { shellTestDocksCreate, shellTestDocksDispose, type ShellTestDocks } from '../shell_test_support.js';

/** Inspector tab ids the reveal command accepts. */
const SHELL_DOCK_COMMANDS_TEST_INSPECTOR_TABS: readonly ShellInspectorTabId[] = ['map', 'entity', 'face'];

/** Docks built by the running test. */
let shellDockCommandsTestDocks: ShellTestDocks | null = null;

/**
 * Builds the docks for one test and remembers them for cleanup.
 *
 * @returns Docks with real frame, inspector and info panel.
 */
function shellDockCommandsTestDocksCreate(): ShellTestDocks {
  shellDockCommandsTestDocks = shellTestDocksCreate();
  return shellDockCommandsTestDocks;
}

afterEach(() => {
  if (shellDockCommandsTestDocks) {
    shellTestDocksDispose(shellDockCommandsTestDocks);
    shellDockCommandsTestDocks = null;
  }
  document.body.replaceChildren();
});

describe('ShellDockCommands', () => {
  SHELL_DOCK_COMMANDS_TEST_INSPECTOR_TABS.forEach((tabId) => {
    it(`reveals the ${tabId} inspector tab, showing the hidden inspector first`, () => {
      const { frame, inspector, dockCommands } = shellDockCommandsTestDocksCreate();
      frame.inspectorVisibleSet(false);
      dockCommands.inspectorTabReveal(tabId);
      expect(frame.isInspectorVisible()).toBe(true);
      expect(inspector.activeTabIdRead()).toBe(tabId);
      expect(dockCommands.isInspectorTabShown(tabId)).toBe(true);
    });
  });

  it('reports a tab as not shown while the inspector is hidden or another tab is in front', () => {
    const { frame, dockCommands } = shellDockCommandsTestDocksCreate();
    dockCommands.inspectorTabReveal('face');
    expect(dockCommands.isInspectorTabShown('map')).toBe(false);
    frame.inspectorVisibleSet(false);
    expect(dockCommands.isInspectorTabShown('face')).toBe(false);
  });

  it('reveals an info panel tab, showing the hidden info panel first', () => {
    const { frame, infoPanel, dockCommands } = shellDockCommandsTestDocksCreate();
    frame.infoPanelVisibleSet(false);
    dockCommands.infoPanelTabReveal('issues');
    expect(frame.isInfoPanelVisible()).toBe(true);
    expect(infoPanel.activeTabIdRead()).toBe('issues');
  });

  it('toggles the inspector, the info panel and the toolbar and reports their visibility', () => {
    const { frame, dockCommands } = shellDockCommandsTestDocksCreate();
    const toggles: ReadonlyArray<readonly [() => void, () => boolean, () => boolean]> = [
      [() => dockCommands.inspectorToggle(), () => dockCommands.isInspectorVisible(), () => frame.isInspectorVisible()],
      [() => dockCommands.infoPanelToggle(), () => dockCommands.isInfoPanelVisible(), () => frame.isInfoPanelVisible()],
      [() => dockCommands.toolbarToggle(), () => dockCommands.isToolbarVisible(), () => frame.isToolbarVisible()],
    ];
    toggles.forEach(([toggle, commandVisibleRead, frameVisibleRead]) => {
      const visibleBefore = frameVisibleRead();
      toggle();
      expect(frameVisibleRead()).toBe(!visibleBefore);
      expect(commandVisibleRead()).toBe(!visibleBefore);
      toggle();
      expect(commandVisibleRead()).toBe(visibleBefore);
    });
  });
});
