import type * as THREE from 'three';
import type { ClipboardPlacementAim } from '@/clipboard/placement/clipboard_placement_cursor.js';
import type { ToolbarMenuAction, ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Returns whether a scene object is an instance of one placeable kind. */
export type AddMenuCatalogObjectMatcher = (object: THREE.Object3D) => boolean;

/**
 * Builds a standalone object that shows what one placeable kind looks like in
 * the 3D view, never added to the map.
 */
export type AddMenuCatalogPreviewFactory = () => THREE.Object3D;

/** Places one instance of a kind at an aimed point of a view. */
export type AddMenuCatalogAimPlacer = (aim: ClipboardPlacementAim) => void;

/** Builds the entries of the right-click menu catalogs show for one kind. */
export type AddMenuCatalogContextEntriesFactory = () => ToolbarMenuEntry[];

/**
 * Describes how a placeable Add menu action appears in catalogs that list every
 * placeable kind, such as the entity browser.
 */
export interface AddMenuCatalogInfo {
  /** Stable identifier that survives label and menu order changes. */
  readonly id: string;
  /** Recognizes scene objects of this kind so catalogs can count usage. */
  readonly objectMatches?: AddMenuCatalogObjectMatcher;
  /** Builds the 3D preview of the kind; catalogs show the icon when omitted. */
  readonly previewCreate?: AddMenuCatalogPreviewFactory;
  /**
   * Places the kind at an aimed point, such as a drop on a view; catalogs run
   * the action along the view ray through the point when omitted.
   */
  readonly placeAtAim?: AddMenuCatalogAimPlacer;
  /** Builds the kind's right-click menu in catalogs; no menu when omitted. */
  readonly contextEntriesCreate?: AddMenuCatalogContextEntriesFactory;
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
