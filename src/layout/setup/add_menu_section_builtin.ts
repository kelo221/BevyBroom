import { gameEntityAddMenuSection } from '@/game_entity/ui/game_entity_add_menu_section.js';
import type { ToolbarMenuEntry } from '@/ui/toolbar/toolbar.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import type { AddMenuSectionFactory } from '@/layout/setup/add_menu_section_registry.js';

/**
 * Returns the Add menu sections the editor ships with, in display order.
 *
 * @returns Section factories.
 */
export function addMenuSectionsBuiltin(): readonly AddMenuSectionFactory[] {
  return [
    addMenuSectionGeometry,
    addMenuSectionTerrain,
    addMenuSectionBrushes,
    addMenuSectionLights,
    addMenuSectionPortals,
    gameEntityAddMenuSection,
  ];
}

/**
 * Builds the Geometry submenu with the primitive meshes.
 *
 * @param actions Creation callbacks.
 * @returns Geometry submenu.
 */
function addMenuSectionGeometry(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Geometry',
    children: [
      { label: 'Cube', onClick: () => actions.onAddCube() },
      { label: 'Sphere', onClick: () => actions.onAddSphere() },
      { label: 'Cylinder', onClick: () => actions.onAddCylinder() },
      { label: 'Plane', onClick: () => actions.onAddPlane() },
    ],
  };
}

/**
 * Builds the Terrain submenu.
 *
 * @param actions Creation callbacks.
 * @returns Terrain submenu.
 */
function addMenuSectionTerrain(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Terrain',
    children: [{ label: 'Terrain', onClick: () => actions.onAddTerrain() }],
  };
}

/**
 * Builds the Brushes submenu with solid models and bevel volumes.
 *
 * @param actions Creation callbacks.
 * @returns Brushes submenu.
 */
function addMenuSectionBrushes(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Brushes',
    children: [
      { label: 'Solid Model', onClick: () => actions.onAddSolidModel() },
      { label: 'Bevel Volume', onClick: () => actions.onAddBevelVolume() },
    ],
  };
}

/**
 * Builds the Lights submenu.
 *
 * @param actions Creation callbacks.
 * @returns Lights submenu.
 */
function addMenuSectionLights(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Lights',
    children: [
      { label: 'Point Light', onClick: () => actions.onAddPointLight() },
      { label: 'Spot Light', onClick: () => actions.onAddSpotLight() },
    ],
  };
}

/**
 * Builds the Portals submenu with rooms and portals.
 *
 * @param actions Creation callbacks.
 * @returns Portals submenu.
 */
function addMenuSectionPortals(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Portals',
    children: [
      { label: 'Room', onClick: () => actions.onAddRoom() },
      { label: 'Portal', onClick: () => actions.onAddPortal() },
    ],
  };
}
