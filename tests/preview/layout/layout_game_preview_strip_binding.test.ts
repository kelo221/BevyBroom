import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutGamePreviewStripBinding } from '@/preview/layout/layout_game_preview_strip_binding.js';
import type { LayoutGamePreview } from '@/preview/layout/layout_game_preview.js';
import { ShellInfoPanel } from '@/layout/shell/info_panel/shell_info_panel.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellTestStorageCreate } from '../../layout/shell/shell_test_support.js';

/** Info panels built by the running test. */
const infoPanels: ShellInfoPanel[] = [];

/**
 * Builds a bottom strip whose state starts on the given tab.
 *
 * @param initialTabId Tab in front when the strip is built.
 * @returns Bottom strip.
 */
function infoPanelCreate(initialTabId: string): ShellInfoPanel {
  const stateStore = new ShellStateStore(shellTestStorageCreate());
  stateStore.update({ infoPanelTabId: initialTabId });
  const infoPanel = new ShellInfoPanel(stateStore);
  infoPanels.push(infoPanel);
  return infoPanel;
}

/**
 * Builds a stand-in game preview layout that records what the binding tells it.
 *
 * @returns Layout stand-in and the recorded shown states.
 */
function layoutStandInCreate(): { layout: LayoutGamePreview; shownStates: boolean[] } {
  const shownStates: boolean[] = [];
  const layout = { panelShownSet: vi.fn((isShown: boolean) => shownStates.push(isShown)) };
  return { layout: layout as unknown as LayoutGamePreview, shownStates };
}

afterEach(() => {
  infoPanels.splice(0).forEach((infoPanel) => infoPanel.dispose());
});

describe('LayoutGamePreviewStripBinding', () => {
  it('shows the page while the Game Preview tab is in front and hides it when another tab is', () => {
    const infoPanel = infoPanelCreate('console');
    const { layout, shownStates } = layoutStandInCreate();
    const binding = new LayoutGamePreviewStripBinding(infoPanel, () => layout);
    expect(shownStates).toEqual([]);
    infoPanel.tabShow('preview');
    infoPanel.tabShow('issues');
    expect(shownStates).toEqual([true, false]);
    binding.dispose();
    infoPanel.tabShow('preview');
    expect(shownStates).toEqual([true, false]);
  });

  it('shows the page at once when the strip starts on the Game Preview tab', () => {
    const infoPanel = infoPanelCreate('preview');
    const { layout, shownStates } = layoutStandInCreate();
    new LayoutGamePreviewStripBinding(infoPanel, () => layout).dispose();
    expect(shownStates).toEqual([true]);
  });
});
