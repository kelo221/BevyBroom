import * as THREE from 'three';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';
import { LightOwner } from '@/light/model/light_owner.js';
import type { LightKind } from '@/light/model/light_settings.js';
import { MODIFIER_VOLUME_BEVEL_USERDATA_KEY } from '@/modifier/volume/modifier_volume_bevel_keys.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { resolveGeometrySourceType, type GeometrySourceType } from '@/texture/uv/geometry_source.js';
import type { AddMenuCatalogObjectMatcher } from '@/layout/setup/add_menu_catalog.js';

/**
 * Returns a matcher for plain primitive meshes built from one geometry type,
 * skipping solid model parts, modifier volumes and entity owners.
 *
 * @param sourceType Geometry type the primitive was built from.
 * @returns Object matcher.
 */
export function addMenuCatalogMatcherPrimitive(sourceType: GeometrySourceType): AddMenuCatalogObjectMatcher {
  return (object) => {
    if (!(object instanceof THREE.Mesh) || !addMenuCatalogPlainMeshIs(object)) {
      return false;
    }
    return resolveGeometrySourceType(object.geometry) === sourceType;
  };
}

/**
 * Returns whether a mesh is a plain content mesh rather than a solid model
 * part, a modifier volume or an entity owner.
 *
 * @param mesh Candidate mesh.
 * @returns True for plain content meshes.
 */
function addMenuCatalogPlainMeshIs(mesh: THREE.Mesh): boolean {
  if (SolidModel.isSolidModelObject(mesh) || SolidModel.isResultMesh(mesh) || SolidBrushVisual.isBrushObject(mesh)) {
    return false;
  }
  if (mesh.userData[MODIFIER_VOLUME_BEVEL_USERDATA_KEY] === true) {
    return false;
  }
  return entityKindRead(mesh) === null;
}

/**
 * Returns a matcher for solid model roots.
 *
 * @returns Object matcher.
 */
export function addMenuCatalogMatcherSolidModel(): AddMenuCatalogObjectMatcher {
  return (object) => SolidModel.isSolidModelObject(object);
}

/**
 * Returns a matcher for bevel modifier volumes.
 *
 * @returns Object matcher.
 */
export function addMenuCatalogMatcherBevelVolume(): AddMenuCatalogObjectMatcher {
  return (object) => object instanceof THREE.Mesh && object.userData[MODIFIER_VOLUME_BEVEL_USERDATA_KEY] === true;
}

/**
 * Returns a matcher for light owners of one light kind.
 *
 * @param lightKind Point or spot.
 * @returns Object matcher.
 */
export function addMenuCatalogMatcherLight(lightKind: LightKind): AddMenuCatalogObjectMatcher {
  return (object) => LightOwner.settingsRead(object)?.kind === lightKind;
}

/**
 * Returns a matcher for owners of one entity kind.
 *
 * @param entityOwner Owner helper of the kind.
 * @returns Object matcher.
 */
export function addMenuCatalogMatcherEntityOwner(entityOwner: EntityOwner<object>): AddMenuCatalogObjectMatcher {
  return (object) => entityOwner.isOwner(object);
}
