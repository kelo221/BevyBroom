import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import { LevelBrowser } from '@/level_browser/ui/level_browser.js';

/** What the layout hands the level browser when mounting it. */
export interface LevelBrowserSetupHost {
  /** Actions on the open project's levels. */
  readonly actions: ProjectLevelActions;
  /** Document that owns the browser; the global document when omitted. */
  readonly ownerDocument?: Document;
}

/**
 * Creates the level browser for the layout.
 *
 * @param host Editor services.
 * @returns Level browser; dispose it with the layout.
 */
export function levelBrowserSetup(host: LevelBrowserSetupHost): LevelBrowser {
  return new LevelBrowser({
    actions: host.actions,
    ...(host.ownerDocument ? { ownerDocument: host.ownerDocument } : {}),
  });
}
