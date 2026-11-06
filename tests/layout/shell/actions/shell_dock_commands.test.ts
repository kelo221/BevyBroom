import { afterEach, describe, expect, it } from 'vitest';
import type { ShellFloatingWindow } from '@/layout/shell/actions/shell_floating_window.js';
import { shellTestDocksCreate, shellTestDocksDispose, type ShellTestDocks } from '../shell_test_support.js';

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

/**
 * Creates a floating window stand-in that flips its open flag on toggle.
 *
 * @returns Floating window with a readable open flag.
 */
function shellDockCommandsTestFloatingWindowCreate(): ShellFloatingWindow {
  let isOpen = false;
  return {
    toggle: () => {
      isOpen = !isOpen;
    },
    isOpen: () => isOpen,
  };
}

describe('ShellDockCommands', () => {
  it('reveals the hidden inspector and leaves a shown inspector shown', () => {
    const { frame, dockCommands } = shellDockCommandsTestDocksCreate();
    frame.inspectorVisibleSet(false);
    dockCommands.inspectorReveal();
    expect(frame.isInspectorVisible()).toBe(true);
    dockCommands.inspectorReveal();
    expect(frame.isInspectorVisible()).toBe(true);
  });

  it('toggles registered floating windows and reports unregistered ones as closed', () => {
    const { dockCommands } = shellDockCommandsTestDocksCreate();
    expect(dockCommands.isFloatingWindowOpen('entity_browser')).toBe(false);
    dockCommands.floatingWindowToggle('entity_browser');
    expect(dockCommands.isFloatingWindowOpen('entity_browser')).toBe(false);
    dockCommands.floatingWindowRegister('entity_browser', shellDockCommandsTestFloatingWindowCreate());
    dockCommands.floatingWindowToggle('entity_browser');
    expect(dockCommands.isFloatingWindowOpen('entity_browser')).toBe(true);
    expect(dockCommands.isFloatingWindowOpen('texture_browser')).toBe(false);
    dockCommands.floatingWindowToggle('entity_browser');
    expect(dockCommands.isFloatingWindowOpen('entity_browser')).toBe(false);
  });

  it('shows and hides a registered floating window without toggling when already in that state', () => {
    const { dockCommands } = shellDockCommandsTestDocksCreate();
    dockCommands.floatingWindowRegister('texture_browser', shellDockCommandsTestFloatingWindowCreate());
    dockCommands.floatingWindowVisibleSet('texture_browser', true);
    expect(dockCommands.isFloatingWindowOpen('texture_browser')).toBe(true);
    dockCommands.floatingWindowVisibleSet('texture_browser', true);
    expect(dockCommands.isFloatingWindowOpen('texture_browser')).toBe(true);
    dockCommands.floatingWindowVisibleSet('texture_browser', false);
    expect(dockCommands.isFloatingWindowOpen('texture_browser')).toBe(false);
  });

  it('reveals an info panel tab, showing the hidden info panel first', () => {
    const { frame, infoPanel, dockCommands } = shellDockCommandsTestDocksCreate();
    frame.infoPanelVisibleSet(false);
    dockCommands.infoPanelTabReveal('issues');
    expect(frame.isInfoPanelVisible()).toBe(true);
    expect(infoPanel.activeTabIdRead()).toBe('issues');
  });

  it('unfolds a folded info panel when revealing a tab', () => {
    const { frame, infoPanel, dockCommands } = shellDockCommandsTestDocksCreate();
    frame.infoPanelCollapsedSet(true);
    dockCommands.infoPanelTabReveal('console');
    expect(frame.isInfoPanelCollapsed()).toBe(false);
    expect(infoPanel.isCollapsedShown()).toBe(false);
    expect(infoPanel.activeTabIdRead()).toBe('console');
  });

  it('folds and unfolds the info panel and reports the folded state', () => {
    const { frame, infoPanel, dockCommands } = shellDockCommandsTestDocksCreate();
    const collapsedBefore = dockCommands.isInfoPanelCollapsed();
    dockCommands.infoPanelCollapsedToggle();
    expect(frame.isInfoPanelCollapsed()).toBe(!collapsedBefore);
    expect(infoPanel.isCollapsedShown()).toBe(!collapsedBefore);
    dockCommands.infoPanelCollapsedToggle();
    expect(dockCommands.isInfoPanelCollapsed()).toBe(collapsedBefore);
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
