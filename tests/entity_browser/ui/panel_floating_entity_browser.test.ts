import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityBrowserSetup } from '@/entity_browser/setup/entity_browser_setup.js';
import { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import { PanelFloatingEntityBrowser } from '@/entity_browser/ui/panel_floating_entity_browser.js';
import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import { entityBrowserTestEditorCreate } from '../entity_browser_test_support.js';

/** Window, its host and browser a test works with. */
interface FloatingEntityBrowserTestRig {
  readonly floatingWindow: PanelFloatingEntityBrowser;
  readonly host: HTMLElement;
  readonly browser: EntityBrowser;
}

/** Rigs built by the running test. */
const floatingEntityBrowserTestRigs: FloatingEntityBrowserTestRig[] = [];

/**
 * Builds a floating entity browser window over a test editor.
 *
 * @returns Test rig.
 */
function floatingEntityBrowserTestRigCreate(): FloatingEntityBrowserTestRig {
  const editor = entityBrowserTestEditorCreate();
  const browser = entityBrowserSetup({
    worldObject: editor.world,
    addMenuActions: editor.actions,
    viewportAtClientPointResolve: () => null,
    spawnCameraOverrideRun: (_camera, action) => action(),
    settingsStore: new EntityBrowserSettingsStore(new MemorySettingsStorage()),
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const floatingWindow = new PanelFloatingEntityBrowser(host, browser);
  const rig = { floatingWindow, host, browser };
  floatingEntityBrowserTestRigs.push(rig);
  return rig;
}

afterEach(() => {
  floatingEntityBrowserTestRigs.splice(0).forEach((rig) => {
    rig.floatingWindow.dispose();
    rig.browser.dispose();
  });
  document.body.replaceChildren();
});

describe('PanelFloatingEntityBrowser', () => {
  it('shows the entity browser under the host only while open', () => {
    const { floatingWindow, host, browser } = floatingEntityBrowserTestRigCreate();
    expect(floatingWindow.entityBrowserRead()).toBe(browser);
    expect(host.contains(browser.getElement())).toBe(false);
    floatingWindow.show();
    expect(host.contains(browser.getElement())).toBe(true);
    expect(host.querySelector('.panel-floating-entity-browser')?.textContent ?? '').toContain('Entity Browser');
    floatingWindow.hide();
    expect(host.contains(browser.getElement())).toBe(false);
  });

  it('refreshes the Used counts every time it opens', () => {
    const { floatingWindow, browser } = floatingEntityBrowserTestRigCreate();
    const usageRefresh = vi.spyOn(browser, 'usageRefresh');
    floatingWindow.show();
    floatingWindow.hide();
    floatingWindow.show();
    expect(usageRefresh).toHaveBeenCalledTimes(2);
  });
});
