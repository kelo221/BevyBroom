import type { NativeMenuBarWire } from '@/native_menu/native_menu_types.js';

/** Listener told the action id of a chosen native menu row. */
export type NativeMenuActionListener = (actionId: string) => boolean;

/** Connection between the page and a native menu bar owned by the desktop host. */
export interface NativeMenuBridge {
  /**
   * Replaces the native menu bar.
   *
   * @param bar Complete menu bar snapshot.
   */
  menuBarSet(bar: NativeMenuBarWire): void;

  /**
   * Sets the listener told when a native menu row is chosen.
   *
   * @param listener Listener; returns whether the action ran.
   */
  actionListenerSet(listener: NativeMenuActionListener): void;
}

declare global {
  interface Window {
    bevybroomNativeMenuBridge?: NativeMenuBridge;
  }
}

/**
 * Returns the native menu bridge installed by the desktop app, or null in a
 * browser and on platforms whose menus stay inside the page.
 *
 * @returns Native menu bridge, or null.
 */
export function nativeMenuBridgeResolve(): NativeMenuBridge | null {
  return typeof window === 'undefined' ? null : (window.bevybroomNativeMenuBridge ?? null);
}
