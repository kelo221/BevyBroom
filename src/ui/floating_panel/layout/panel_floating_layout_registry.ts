import type { PanelFloating } from '../panel_floating.js';
import type { PanelFloatingDockBinding } from './panel_floating_dock_binding.js';

/** Dock system that lays out the floating windows with a layout id. */
export interface PanelFloatingLayoutProvider {
  /**
   * Returns the dock binding of a window, creating it on first use.
   *
   * @param panel Window with a layout id.
   * @returns Its binding.
   */
  bindingFor(panel: PanelFloating): PanelFloatingDockBinding;
  /**
   * Learns about a window with a layout id.
   *
   * @param panel Window just created, or created before the provider.
   */
  panelAdded(panel: PanelFloating): void;
  /**
   * Forgets a disposed window.
   *
   * @param panel Disposed window.
   */
  panelRemoved(panel: PanelFloating): void;
}

/**
 * Keeps every floating window that has a layout id and the dock system that
 * lays them out, so windows created anywhere join the dock system.
 */
export class PanelFloatingLayoutRegistry {
  private static readonly panels = new Set<PanelFloating>();
  private static provider: PanelFloatingLayoutProvider | null = null;

  /**
   * Adds a window with a layout id and tells the dock system.
   *
   * @param panel New window.
   */
  static panelAdd(panel: PanelFloating): void {
    this.panels.add(panel);
    this.provider?.panelAdded(panel);
  }

  /**
   * Removes a disposed window and tells the dock system.
   *
   * @param panel Disposed window.
   */
  static panelRemove(panel: PanelFloating): void {
    if (this.panels.delete(panel)) {
      this.provider?.panelRemoved(panel);
    }
  }

  /**
   * Lists the windows with a layout id.
   *
   * @returns Windows in creation order.
   */
  static panelsList(): PanelFloating[] {
    return [...this.panels];
  }

  /**
   * Installs or removes the dock system and tells a new one about every
   * existing window.
   *
   * @param provider Dock system, or null to remove it.
   */
  static providerSet(provider: PanelFloatingLayoutProvider | null): void {
    this.provider = provider;
    this.panels.forEach((panel) => provider?.panelAdded(panel));
  }

  /**
   * Returns the installed dock system.
   *
   * @returns Dock system, or null without one.
   */
  static providerRead(): PanelFloatingLayoutProvider | null {
    return this.provider;
  }

  /**
   * Returns the dock binding of a window.
   *
   * @param panel Window with a layout id.
   * @returns Binding, or null without a dock system.
   */
  static bindingResolve(panel: PanelFloating): PanelFloatingDockBinding | null {
    return this.provider?.bindingFor(panel) ?? null;
  }
}
