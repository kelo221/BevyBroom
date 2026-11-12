/**
 * Type-only shim for `electrobun/main`. The Electrobun 2.x SDK is projected by
 * Hutch into `.hutch/devkit` at build time, which type checks cannot rely on,
 * so builds resolve the real SDK while type checks use these declarations.
 */

/** Local app info returned by the Electrobun updater. */
export type ElectrobunLocalInfo = {
  version: string;
};

/** Result of checking the Electrobun release channel. */
export type ElectrobunUpdateCheck = {
  version: string;
  updateAvailable: boolean;
  error?: string;
};

/** Window frame rectangle. */
export type ElectrobunWindowFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Native display information used to size desktop windows. */
export type ElectrobunDisplay = {
  workArea: ElectrobunWindowFrame;
};

/** Browser window construction options. */
export type ElectrobunWindowOptions = {
  title?: string;
  url?: string;
  frame?: ElectrobunWindowFrame;
  hidden?: boolean;
  activate?: boolean;
  /**
   * Native title bar style; hiddenInset keeps the macOS window buttons over the
   * page.
   */
  titleBarStyle?: 'hidden' | 'hiddenInset' | 'default';
  rpc?: unknown;
};

/** One item of the native application menu. */
export type ElectrobunApplicationMenuItem =
  | { type: 'divider' | 'separator' }
  | {
      label?: string;
      action?: string;
      role?: string;
      enabled?: boolean;
      checked?: boolean;
      accelerator?: string;
      submenu?: ElectrobunApplicationMenuItem[];
    };

/** Native application menu (the macOS menu bar). */
export const ApplicationMenu = {
  /**
   * Replaces the native application menu.
   *
   * @param _menu Top-level menus with their items.
   */
  setApplicationMenu(_menu: ElectrobunApplicationMenuItem[]): void {},

  /**
   * Subscribes to clicks on application menu items.
   *
   * @param _name Event name.
   * @param _handler Receives the click event with its action string.
   */
  on(_name: 'application-menu-clicked', _handler: (event: unknown) => void): void {},
};

/** Configuration for defineRPC on the Bun side. */
export type DefineRpcConfig = {
  /** Optional request timeout in milliseconds. */
  maxRequestTime?: number;
  handlers: {
    requests?: Record<string, (...args: never[]) => unknown>;
    messages?: Record<string, unknown>;
  };
};

/** Bun-side browser view helpers. */
export class BrowserView {
  /**
   * Defines a typed RPC schema for bun-to-browser communication.
   *
   * @param _config Handler configuration for requests and messages.
   * @returns RPC instance attached to browser windows.
   */
  static defineRPC<TSchema>(_config: DefineRpcConfig): TSchema {
    return {} as TSchema;
  }

  /**
   * Subscribes to a browser-surface lifecycle event.
   *
   * @param _name Event name.
   * @param _handler Event callback.
   */
  on(_name: 'dom-ready', _handler: () => void): void {}
}

/** Native desktop window host. */
export class BrowserWindow {
  /** Browser surface hosted by this window. */
  readonly webview = new BrowserView();

  /** @param _options Window title, URL, frame, and RPC binding. */
  constructor(_options: ElectrobunWindowOptions) {}

  /** Expands the native window to the available desktop size. */
  maximize(): void {}

  /** Shows and activates the native window. */
  show(): void {}

  /**
   * Returns whether the native window is minimized.
   *
   * @returns True while minimized.
   */
  isMinimized(): boolean {
    return false;
  }

  /** Restores a minimized native window. */
  unminimize(): void {}
}

/** Application level events and lifecycle of the running app. */
export const app = {
  /**
   * Subscribes to an application event such as "reopen" or "before-quit".
   *
   * @param _name Event name.
   * @param _handler Receives the event payload.
   */
  on(_name: string, _handler: (payload: unknown) => void): void {},
};

/** Native screen information exposed by Electrobun. */
export const Screen = {
  /** @returns Primary display bounds and usable work area. */
  getPrimaryDisplay(): ElectrobunDisplay {
    return { workArea: { x: 0, y: 0, width: 800, height: 600 } };
  },
};

/** Electrobun built-in updater API. */
export const Updater = {
  /** @returns Local package version information. */
  async getLocalInfo(): Promise<ElectrobunLocalInfo> {
    return { version: '0.0.0' };
  },

  /** @returns Channel update availability information. */
  async checkForUpdate(): Promise<ElectrobunUpdateCheck> {
    return { version: '0.0.0', updateAvailable: false };
  },

  /** Downloads the available update package. */
  async downloadUpdate(): Promise<void> {},

  /** Applies a downloaded update and restarts. */
  async applyUpdate(): Promise<void> {},
};

/** Electrobun utility helpers. */
export const Utils = {
  /** Well-known folders of the running app. */
  paths: {
    /** @returns Per-app user data folder (`<appData>/<identifier>/<rootName>`). */
    get userData(): string {
      return '';
    },
  },

  /**
   * Shows the native open dialog.
   *
   * @param _options Starting folder, allowed extensions and what may be chosen.
   * @returns Chosen paths; empty or one blank path when cancelled.
   */
  async openFileDialog(_options: {
    startingFolder?: string;
    allowedFileTypes?: string;
    canChooseFiles?: boolean;
    canChooseDirectory?: boolean;
    allowsMultipleSelection?: boolean;
  }): Promise<string[]> {
    return [];
  },
};

/** Loose string-keyed record of Electrobun application configuration. */
export type ElectrobunConfig = Record<string, unknown>;
