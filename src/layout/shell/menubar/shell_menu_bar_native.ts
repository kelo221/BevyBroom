import type { ShellMenu, ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { nativeMenuBridgeResolve, type NativeMenuBridge } from '@/native_menu/native_menu_bridge.js';
import { NativeMenuBarSync } from '@/native_menu/native_menu_bar_sync.js';

/**
 * Moves the main window menus into the native menu bar when the desktop app
 * offers one: hides the page menu bar row and keeps the native menus in step.
 *
 * @param menuBarHost Row that holds the page menu bar.
 * @param menus Main window menus in menu bar order.
 * @param context Actions and docks the menu entries run.
 * @param bridge Native menu bridge; defaults to the one the desktop app
 *   installed.
 * @returns Running sync, or null when the page keeps its own menu bar.
 */
export function shellMenuBarNativeAttach(
  menuBarHost: HTMLElement,
  menus: readonly ShellMenu[],
  context: ShellMenuContext,
  bridge: NativeMenuBridge | null = nativeMenuBridgeResolve(),
): NativeMenuBarSync | null {
  if (!bridge) {
    return null;
  }
  menuBarHost.style.display = 'none';
  const sources = menus.map((menu) => ({ label: menu.label, entries: menu.entriesBuild(context) }));
  const sync = new NativeMenuBarSync(bridge, sources, menuBarHost.ownerDocument);
  sync.start();
  return sync;
}
