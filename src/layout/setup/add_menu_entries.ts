import type * as THREE from 'three';
import type { ToolbarMenuEntry } from '@/ui/toolbar/toolbar.js';
import { AddMenuSectionRegistry } from '@/layout/setup/add_menu_section_registry.js';

/** Creation callbacks for each supported object type. */
export interface AddMenuActions {
  onAddCube: () => void;
  onAddSphere: () => void;
  onAddCylinder: () => void;
  onAddPlane: () => void;
  onAddTerrain: () => void;
  onAddSolidModel: () => void;
  onAddBevelVolume: () => void;
  onAddPointLight: () => void;
  onAddSpotLight: () => void;
  onAddRoom: () => void;
  onAddPortal: () => void;
  /**
   * Adds an entity owner built by a factory at the spawn point as one undoable
   * step and selects it.
   */
  onAddEntityPlaced: (factory: () => THREE.Group, objectRadius: number) => void;
}

/**
 * Creates the categorized entries shown under the editor's Add menu: one
 * submenu per registered Add menu section.
 *
 * @param actions Creation callbacks for each supported object type.
 * @returns Nested Add menu entries grouped by editor object category.
 */
export function createAddMenuEntries(actions: AddMenuActions): ToolbarMenuEntry[] {
  return AddMenuSectionRegistry.entriesCreate(actions);
}
