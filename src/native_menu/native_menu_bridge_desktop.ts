import type { NativeMenuActionListener, NativeMenuBridge } from '@/native_menu/native_menu_bridge.js';
import type { NativeMenuActionRunParams, NativeMenuBarWire } from '@/native_menu/native_menu_types.js';

/** Request surface of the desktop main process that owns the native menu bar. */
export interface NativeMenuBridgeDesktopRpc {
  request: {
    nativeMenuBarSet: (bar: NativeMenuBarWire) => Promise<void>;
  };
}

/** Native menu bridge of the desktop app: menu bars go to its main process. */
export class NativeMenuBridgeDesktop implements NativeMenuBridge {
  private readonly rpc: NativeMenuBridgeDesktopRpc;
  private actionListener: NativeMenuActionListener | null = null;

  /**
   * Creates the bridge.
   *
   * @param rpc Requests of the desktop main process.
   */
  constructor(rpc: NativeMenuBridgeDesktopRpc) {
    this.rpc = rpc;
  }

  /**
   * Sends a menu bar snapshot to the main process.
   *
   * @param bar Complete menu bar snapshot.
   */
  menuBarSet(bar: NativeMenuBarWire): void {
    void this.rpc.request.nativeMenuBarSet(bar).catch((error: unknown) => {
      console.warn('[BevyBroom] Native menu bar update failed.', error);
    });
  }

  /**
   * Sets the listener told when a native menu row is chosen.
   *
   * @param listener Listener; returns whether the action ran.
   */
  actionListenerSet(listener: NativeMenuActionListener): void {
    this.actionListener = listener;
  }

  /**
   * Runs the action of a chosen native menu row.
   *
   * @param params Id of the chosen row.
   * @returns True when a listener ran the action.
   */
  actionRun(params: NativeMenuActionRunParams): boolean {
    return this.actionListener?.(params.actionId) ?? false;
  }
}
