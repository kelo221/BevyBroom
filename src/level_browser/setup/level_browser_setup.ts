import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import { LevelBrowser } from '@/level_browser/ui/level_browser.js';
import { PanelFloatingLevelBrowser } from '@/level_browser/ui/panel_floating_level_browser.js';

/** What the layout hands the level browser when mounting it. */
export interface LevelBrowserSetupHost {
  /** Main window root that floating windows mount into. */
  readonly floatingWindowHost: HTMLElement;
  /** Actions on the open project's levels. */
  readonly actions: ProjectLevelActions;
  /** Document that owns the browser; the global document when omitted. */
  readonly ownerDocument?: Document;
}

/**
 * Creates the level browser and its floating window for the layout.
 *
 * @param host Editor services.
 * @returns Floating level browser window; dispose it with the layout.
 */
export function levelBrowserSetup(host: LevelBrowserSetupHost): PanelFloatingLevelBrowser {
  const browser = new LevelBrowser({
    actions: host.actions,
    ...(host.ownerDocument ? { ownerDocument: host.ownerDocument } : {}),
  });
  return new PanelFloatingLevelBrowser(host.floatingWindowHost, browser);
}
