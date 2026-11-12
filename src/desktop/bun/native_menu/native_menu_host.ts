import type { NativeMenuBarWire } from '@/native_menu/native_menu_types.js';
import {
  nativeMenuApplicationActionIdRead,
  nativeMenuApplicationConfigBuild,
  type NativeMenuApplicationConfigItem,
} from '@/desktop/bun/native_menu/native_menu_application_config.js';

/** Electrobun application menu functions the host needs. */
export interface NativeMenuHostApplicationMenu {
  setApplicationMenu(menu: NativeMenuApplicationConfigItem[]): void;
  on(name: 'application-menu-clicked', handler: (event: unknown) => void): void;
}

/** Runs a chosen page menu row inside the page. */
export type NativeMenuHostActionRunner = (actionId: string) => void;

/**
 * Owns the macOS menu bar of the desktop app: installs the page menu bar
 * snapshots and forwards clicked rows back to the page.
 */
export class NativeMenuHost {
  private readonly applicationMenu: NativeMenuHostApplicationMenu;
  private readonly applicationName: string;

  /**
   * Creates the host and starts listening for clicked rows.
   *
   * @param applicationMenu Electrobun application menu functions.
   * @param applicationName Name shown in the application menu.
   * @param actionRunner Runs a chosen page row inside the page.
   */
  constructor(
    applicationMenu: NativeMenuHostApplicationMenu,
    applicationName: string,
    actionRunner: NativeMenuHostActionRunner,
  ) {
    this.applicationMenu = applicationMenu;
    this.applicationName = applicationName;
    applicationMenu.on('application-menu-clicked', (event) => this.clickedHandle(event, actionRunner));
  }

  /**
   * Installs a page menu bar snapshot as the application menu.
   *
   * @param bar Page menu bar.
   */
  menuBarSet(bar: NativeMenuBarWire): void {
    this.applicationMenu.setApplicationMenu(nativeMenuApplicationConfigBuild(bar, this.applicationName));
  }

  /**
   * Forwards a clicked page row to the page.
   *
   * @param event Electrobun menu click event.
   * @param actionRunner Runs a chosen page row inside the page.
   */
  private clickedHandle(event: unknown, actionRunner: NativeMenuHostActionRunner): void {
    const action = (event as { data?: { action?: unknown } }).data?.action;
    const actionId = typeof action === 'string' ? nativeMenuApplicationActionIdRead(action) : null;
    if (actionId !== null) {
      actionRunner(actionId);
    }
  }
}
