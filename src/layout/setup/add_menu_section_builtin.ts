import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault, type LightKind } from '@/light/model/light_settings.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { roomSettingsCreateDefault } from '@/portal/model/room_settings.js';
import { gameEntityAddMenuSection } from '@/game_entity/ui/game_entity_add_menu_section.js';
import type { ToolbarMenuEntry } from '@/ui/toolbar/toolbar.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import type { AddMenuSectionFactory } from '@/layout/setup/add_menu_section_registry.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import type { GeometrySourceType } from '@/texture/uv/geometry_source.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { addMenuCatalogActionCreate } from '@/layout/setup/add_menu_catalog.js';
import {
  addMenuCatalogMatcherBevelVolume,
  addMenuCatalogMatcherEntityOwner,
  addMenuCatalogMatcherLight,
  addMenuCatalogMatcherPrimitive,
  addMenuCatalogMatcherSolidModel,
} from '@/layout/setup/add_menu_catalog_matchers.js';

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
    icon: 'cube-outline',
    children: [
      addMenuSectionGeometryEntry('Cube', 'cube-outline', 'box', () => actions.onAddCube()),
      addMenuSectionGeometryEntry('Sphere', 'sphere', 'sphere', () => actions.onAddSphere()),
      addMenuSectionGeometryEntry('Cylinder', 'cylinder', 'cylinder', () => actions.onAddCylinder()),
      addMenuSectionGeometryEntry('Plane', 'square-outline', 'plane', () => actions.onAddPlane()),
    ],
  };
}

/**
 * Builds the entry that adds one primitive mesh.
 *
 * @param label Visible label.
 * @param icon Menu icon.
 * @param sourceType Geometry type the primitive is built from; also its id.
 * @param onClick Creation callback.
 * @returns Menu action with catalog information.
 */
function addMenuSectionGeometryEntry(
  label: string,
  icon: IconName,
  sourceType: GeometrySourceType,
  onClick: () => void,
): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    { label, icon, onClick },
    { id: `geometry.${sourceType}`, objectMatches: addMenuCatalogMatcherPrimitive(sourceType) },
  );
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
    icon: 'terrain',
    children: [
      addMenuCatalogActionCreate(
        { label: 'Terrain', icon: 'terrain', onClick: () => actions.onAddTerrain() },
        { id: 'terrain.terrain' },
      ),
    ],
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
    icon: 'shape-outline',
    children: [
      addMenuCatalogActionCreate(
        { label: 'Solid Model', icon: 'shape-outline', onClick: () => actions.onAddSolidModel() },
        { id: 'brushes.solid_model', objectMatches: addMenuCatalogMatcherSolidModel() },
      ),
      addMenuCatalogActionCreate(
        { label: 'Bevel Volume', icon: 'rounded-corner', onClick: () => actions.onAddBevelVolume() },
        { id: 'brushes.bevel_volume', objectMatches: addMenuCatalogMatcherBevelVolume() },
      ),
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
    icon: LightOwner.definition.iconName(lightSettingsCreateDefault('point')),
    children: [
      addMenuSectionLightEntry('Point Light', 'point', () => actions.onAddPointLight()),
      addMenuSectionLightEntry('Spot Light', 'spot', () => actions.onAddSpotLight()),
    ],
  };
}

/**
 * Builds the entry that adds one kind of light.
 *
 * @param label Visible label.
 * @param lightKind Point or spot.
 * @param onClick Creation callback.
 * @returns Menu action with catalog information.
 */
function addMenuSectionLightEntry(label: string, lightKind: LightKind, onClick: () => void): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    { label, icon: LightOwner.definition.iconName(lightSettingsCreateDefault(lightKind)), onClick },
    { id: `lights.${lightKind}`, objectMatches: addMenuCatalogMatcherLight(lightKind) },
  );
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
    icon: PortalOwner.definition.iconName(portalSettingsCreateDefault()),
    children: [
      addMenuSectionEntityOwnerEntry(
        'Room',
        RoomOwner.definition.iconName(roomSettingsCreateDefault()),
        'portals.room',
        RoomOwner,
        () => actions.onAddRoom(),
      ),
      addMenuSectionEntityOwnerEntry(
        'Portal',
        PortalOwner.definition.iconName(portalSettingsCreateDefault()),
        'portals.portal',
        PortalOwner,
        () => actions.onAddPortal(),
      ),
    ],
  };
}

/**
 * Builds the entry that adds one entity owner kind, counting owners of that
 * kind as its instances.
 *
 * @param label Visible label.
 * @param icon Menu icon.
 * @param catalogId Stable catalog id.
 * @param entityOwner Owner helper of the kind.
 * @param onClick Creation callback.
 * @returns Menu action with catalog information.
 */
function addMenuSectionEntityOwnerEntry(
  label: string,
  icon: IconName,
  catalogId: string,
  entityOwner: EntityOwner<object>,
  onClick: () => void,
): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    { label, icon, onClick },
    { id: catalogId, objectMatches: addMenuCatalogMatcherEntityOwner(entityOwner) },
  );
}
