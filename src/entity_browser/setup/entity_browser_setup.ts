import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import {
  EntityBrowserPlacementAtClientPoint,
  type EntityBrowserPlacementHost,
} from '@/entity_browser/placement/entity_browser_placement_at_client_point.js';
import type { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';

/** What the layout hands the entity browser when mounting it. */
export interface EntityBrowserSetupHost extends EntityBrowserPlacementHost {
  /** Root of the map; its content is counted for the Used filter. */
  readonly worldObject: THREE.Object3D;
  /** Creation callbacks the Add menu entries call, such as the toolbar actions. */
  readonly addMenuActions: AddMenuActions;
  /**
   * Registers a callback run after the map content changed.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  worldChangeSubscribe?(listener: () => void): () => void;
  /** Store of the display choices; a local storage store when omitted. */
  readonly settingsStore?: EntityBrowserSettingsStore;
  /** Document that owns the browser; the global document when omitted. */
  readonly ownerDocument?: Document;
}

/**
 * Creates the entity browser for the layout: drops on viewports place entries
 * on the view ray through the drop point, map changes refresh usage counts and
 * game class changes refresh the catalog. Disposing the browser removes the
 * subscriptions.
 *
 * @param host Editor services.
 * @returns Entity browser; mount its element.
 */
export function entityBrowserSetup(host: EntityBrowserSetupHost): EntityBrowser {
  const placement = new EntityBrowserPlacementAtClientPoint(host);
  const browser = new EntityBrowser({
    worldObject: host.worldObject,
    addMenuActions: host.addMenuActions,
    entityPlace: (entry, clientX, clientY) => placement.place(entry, clientX, clientY),
    placementTargetCheck: (clientX, clientY) => placement.isPlacementTarget(clientX, clientY),
    ...entityBrowserSetupOptionalFields(host),
  });
  browser.disposeCallbackAdd(GameEntityClassRegistry.changeListenerAdd(() => browser.refresh()));
  const worldChangeUnsubscribe = host.worldChangeSubscribe?.(() => browser.usageRefresh());
  if (worldChangeUnsubscribe) {
    browser.disposeCallbackAdd(worldChangeUnsubscribe);
  }
  return browser;
}

/**
 * Copies the optional settings store and document only when the host has them.
 *
 * @param host Editor services.
 * @returns Optional browser host fields.
 */
function entityBrowserSetupOptionalFields(host: EntityBrowserSetupHost): {
  settingsStore?: EntityBrowserSettingsStore;
  ownerDocument?: Document;
} {
  return {
    ...(host.settingsStore ? { settingsStore: host.settingsStore } : {}),
    ...(host.ownerDocument ? { ownerDocument: host.ownerDocument } : {}),
  };
}
