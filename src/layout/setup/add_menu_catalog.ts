import type * as THREE from 'three';
import type { ToolbarMenuAction } from '@/ui/menu/menu_types.js';

/** Returns whether a scene object is an instance of one placeable kind. */
export type AddMenuCatalogObjectMatcher = (object: THREE.Object3D) => boolean;

/**
 * Describes how a placeable Add menu action appears in catalogs that list every
 * placeable kind, such as the entity browser.
 */
export interface AddMenuCatalogInfo {
  /** Stable identifier that survives label and menu order changes. */
  readonly id: string;
  /** Recognizes scene objects of this kind so catalogs can count usage. */
  readonly objectMatches?: AddMenuCatalogObjectMatcher;
}

/** Add menu action that carries catalog information. */
export interface AddMenuCatalogAction extends ToolbarMenuAction {
  readonly catalog: AddMenuCatalogInfo;
}

/**
 * Returns a copy of an Add menu action that carries catalog information.
 *
 * @param action Menu action.
 * @param catalog Catalog identity and object matcher of the action.
 * @returns Action with catalog information.
 */
export function addMenuCatalogActionCreate(
  action: ToolbarMenuAction,
  catalog: AddMenuCatalogInfo,
): AddMenuCatalogAction {
  return { ...action, catalog };
}

/**
 * Returns the catalog information of an Add menu action.
 *
 * @param action Menu action, with or without catalog information.
 * @returns Catalog information, or null when the action carries none.
 */
export function addMenuCatalogInfoRead(action: ToolbarMenuAction): AddMenuCatalogInfo | null {
  if (!addMenuCatalogActionIs(action)) {
    return null;
  }
  return action.catalog;
}

/**
 * Returns whether an Add menu action carries catalog information.
 *
 * @param action Menu action.
 * @returns True when the action has a catalog record with an id.
 */
function addMenuCatalogActionIs(action: ToolbarMenuAction): action is AddMenuCatalogAction {
  const catalog: unknown = (action as Partial<AddMenuCatalogAction>).catalog;
  if (typeof catalog !== 'object' || catalog === null) {
    return false;
  }
  return typeof (catalog as Partial<AddMenuCatalogInfo>).id === 'string';
}
