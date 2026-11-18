import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import type { LevelBrowser } from '@/level_browser/ui/level_browser.js';
import type { FaceInspector } from '@/texture/ui/face_inspector/face_inspector.js';
import { PanelFloatingBrowser } from '@/browser/ui/panel_floating_browser.js';
import { BrowserTabWindow } from '@/browser/ui/browser_tab_window.js';

/** Browsers whose elements become the tabs of the Browser window. */
export interface BrowserWindowSetupContents {
  /** Parent element of floating windows. */
  readonly host: HTMLElement;
  /** Entity browser shown on the Place tab. */
  readonly entityBrowser: EntityBrowser;
  /** Face inspector shown on the Textures tab. */
  readonly faceInspector: FaceInspector;
  /** Level browser shown on the Levels tab. */
  readonly levelBrowser: LevelBrowser;
}

/**
 * The Browser window of the main window with one window view per tab: Place
 * (entities, lights, prefabs), Textures and Levels.
 */
export class BrowserWindowSetup {
  /** The Browser window. */
  readonly browser: PanelFloatingBrowser;
  /** Place tab seen as a window. */
  readonly placeTab: BrowserTabWindow;
  /** Textures tab seen as a window. */
  readonly texturesTab: BrowserTabWindow;
  /** Levels tab seen as a window. */
  readonly levelsTab: BrowserTabWindow;
  private readonly levelBrowser: LevelBrowser;

  /**
   * Builds the Browser window around the three browsers.
   *
   * @param contents Browsers shown on the tabs and the window host.
   */
  constructor(contents: BrowserWindowSetupContents) {
    this.levelBrowser = contents.levelBrowser;
    contents.faceInspector.getFaceAttributesEditor().trsControlsVisibleSet(false);
    this.browser = new PanelFloatingBrowser(contents.host, [
      {
        tabId: 'place',
        element: contents.entityBrowser.getElement(),
        onShown: () => contents.entityBrowser.usageRefresh(),
      },
      { tabId: 'textures', element: contents.faceInspector.getElement() },
      { tabId: 'levels', element: contents.levelBrowser.getElement(), onShown: () => contents.levelBrowser.refresh() },
    ]);
    this.placeTab = new BrowserTabWindow(this.browser, 'place');
    this.texturesTab = new BrowserTabWindow(this.browser, 'textures');
    this.levelsTab = new BrowserTabWindow(this.browser, 'levels');
  }

  /**
   * Opens the Levels tab and puts the keyboard focus into the level list, or
   * into the name field when a new level is to be named.
   *
   * @param isNameFieldFocused True to focus the name field.
   */
  levelsReveal(isNameFieldFocused: boolean): void {
    this.levelsTab.show();
    const focused = isNameFieldFocused ? this.levelBrowser.nameInputRead() : this.levelBrowser.listElementRead();
    focused.focus();
  }

  /**
   * Removes the Browser window. The browsers on its tabs are disposed by their
   * owners.
   */
  dispose(): void {
    this.browser.dispose();
  }
}
