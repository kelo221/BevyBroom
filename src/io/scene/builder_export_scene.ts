import * as THREE from 'three';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { DECORATIVE_EDGE_USERDATA_KEY, isSolidBrushEdge } from '@/utils/mesh_edge_sync.js';
import { SELECTION_HIGHLIGHT_USERDATA_KEY } from '@/selection/object/selection_highlight.js';
import { CONTENT_METALNESS, CONTENT_ROUGHNESS } from '@/materials/factory_content_material.js';
import { isContentViewLitMaterial } from '@/materials/factory_content_view_lit_material.js';
import { isDefaultSurfaceTexture } from '@/texture/library/factory_debug_texture.js';
import { entityOwnerIs, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';
import { LightmapUvLayout } from '@/io/glb/lightmap/lightmap_uv_layout.js';
import { MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY, materialIdentityRead } from '@/materials/identity/material_identity.js';
import {
  getSharedContentMaterials,
  meshUsesShadingOverrideMaterials,
} from '@/viewports/shared/shared_content_material_store.js';
import { objectInOmittedLayerIs } from '@/layer/model/layer_membership.js';

/** Export extras key that carries the stable editor identifier of a node. */
export const EXPORT_OBJECT_IDENTITY_EXTRAS_KEY = 'broom_id';

/**
 * Export extras key that marks a mesh node as static level geometry for light
 * baking.
 */
export const EXPORT_STATIC_MESH_EXTRAS_KEY = 'dynlight_static';

/** Optional behavior switches for building an export scene. */
export interface ExportSceneOptions {
  /**
   * Returns true for material identifiers whose texture maps are resolved by
   * the game and must not be embedded.
   */
  isMaterialMapResolvedByGame?: (materialIdentifier: string) => boolean;
  /**
   * Keeps hidden objects in the export so a receiver can toggle their
   * visibility itself.
   */
  includeHiddenObjects?: boolean;
  /**
   * Writes rooms and portals as empty nodes carrying DynLight room and portal
   * extras.
   */
  includeRoomAndPortalNodes?: boolean;
  /**
   * Writes game entities as empty nodes and every object's game components as
   * `broom_components` extras.
   */
  includeGameComponents?: boolean;
  /** Adds a non-overlapping second UV set (`uv1`) to every mesh for lightmaps. */
  includeLightmapUvs?: boolean;
}

/**
 * Returns the content materials of a mesh, looking past temporary viewport
 * shading overrides such as wireframe materials.
 *
 * @param mesh Live content mesh.
 * @returns The materials the mesh shows in normal shading.
 */
export function exportContentMaterialResolve(mesh: THREE.Mesh): THREE.Material | THREE.Material[] {
  if (!meshUsesShadingOverrideMaterials(mesh)) {
    return mesh.material;
  }
  return getSharedContentMaterials(mesh.uuid)?.materials ?? mesh.material;
}

/**
 * Builds a temporary scene graph for GLB/export that contains only game
 * content: regular meshes/groups and solid-model CSG result meshes. Excludes
 * brush hull helpers, selection outlines, decorative edges, and clip previews.
 *
 * @param worldGroup Live editor world root.
 * @param options Optional behavior switches.
 * @returns A detached group safe to pass to GLTFExporter (does not mutate the
 *   live scene).
 */
export function buildExportScene(worldGroup: THREE.Group, options: ExportSceneOptions = {}): THREE.Group {
  const exportRoot = new THREE.Group();
  exportRoot.name = worldGroup.name || 'ExportRoot';
  worldGroup.children.forEach((child) => {
    const cloned = cloneObjectForExport(child, options);
    if (cloned) exportRoot.add(cloned);
  });
  return exportRoot;
}

/**
 * Clones one scene object for export, or returns null when it should be
 * omitted, including objects in layers left out of exports.
 *
 * @param object Live scene object.
 * @param options Export behavior switches.
 * @returns Detached export clone, or null to skip.
 */
function cloneObjectForExport(object: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D | null {
  if (objectInOmittedLayerIs(object)) return null;
  if (entityOwnerIs(object)) {
    return cloneEntityOwnerForExport(object, options);
  }
  if (shouldOmitFromExport(object)) return null;
  if (SolidModel.isSolidModelObject(object)) {
    return cloneSolidModelForExport(object, options);
  }
  if (object instanceof THREE.Mesh) {
    return cloneContentMeshForExport(object, options);
  }
  if (object instanceof THREE.Group) {
    return cloneGroupForExport(object, options);
  }
  return null;
}

/**
 * Returns whether an object is editor-internal and must not appear in exports.
 *
 * @param object Candidate object.
 * @returns True when the object should be omitted.
 */
export function shouldOmitFromExport(object: THREE.Object3D): boolean {
  if (SolidBrushVisual.isBrushObject(object)) return true;
  if (isSolidBrushEdge(object)) return true;
  if (object.userData[DECORATIVE_EDGE_USERDATA_KEY] === true) return true;
  if (object.userData[SELECTION_HIGHLIGHT_USERDATA_KEY] === true) return true;
  if (object.userData['isSelectionHighlight'] === true) return true;
  if (object.userData['isWireframeOverlay'] === true) return true;
  if (object.userData['isFaceSelectionHighlight'] === true) return true;
  if (object.userData['isClipPlanePreview'] === true) return true;
  if (object.userData['isBoundsGuideLines'] === true) return true;
  if (object.userData['isGizmoOccludedGhost'] === true) return true;
  if (object.userData['isCadRuler'] === true) return true;
  if (object.userData['isSolidBrushPreview'] === true) return true;
  if (object.userData['isModifierVolume'] === true) return true;
  if (object.userData['isModifierVolumeEdge'] === true) return true;
  if (entityOwnerIs(object) || entityVisualPartIs(object)) return true;
  return false;
}

/**
 * Clones an entity owner as a group holding the export children an object data
 * contributor builds for it.
 *
 * @param owner Entity owner.
 * @param options Export behavior switches.
 * @returns Export group, or null when no contributor exports the owner.
 */
function cloneEntityOwnerForExport(owner: THREE.Object3D, options: ExportSceneOptions): THREE.Group | null {
  const children = ObjectDataContributorRegistry.exportEntityChildrenCreate(owner, options);
  if (children === null) return null;
  const group = new THREE.Group();
  copyObjectTransformAndIdentity(owner, group, options);
  group.name = owner.name;
  children.forEach((child) => group.add(child));
  return group;
}

/**
 * Clones a solid model as a group containing only the compiled CSG result mesh.
 *
 * @param solidRoot Solid model root group.
 * @param options Export behavior switches.
 * @returns Export group with result mesh, or null when no result exists.
 */
function cloneSolidModelForExport(solidRoot: THREE.Object3D, options: ExportSceneOptions): THREE.Group | null {
  const resultMesh = findSolidResultMesh(solidRoot);
  if (!resultMesh) return null;
  const group = new THREE.Group();
  copyObjectTransformAndIdentity(solidRoot, group, options);
  group.name = solidRoot.name || 'SolidModel';
  const resultClone = cloneContentMeshForExport(resultMesh, options);
  group.add(resultClone);
  return group;
}

/**
 * Finds the CSG result mesh under a solid model root.
 *
 * @param solidRoot Solid model root.
 * @returns Result mesh or null.
 */
function findSolidResultMesh(solidRoot: THREE.Object3D): THREE.Mesh | null {
  for (const child of solidRoot.children) {
    if (child instanceof THREE.Mesh && SolidModel.isResultMesh(child)) {
      return child;
    }
  }
  return null;
}

/**
 * Clones a hierarchy group, keeping only exportable descendants.
 *
 * @param group Live group.
 * @param options Export behavior switches.
 * @returns Export group, or null when empty after filtering.
 */
function cloneGroupForExport(group: THREE.Group, options: ExportSceneOptions): THREE.Group | null {
  const clone = new THREE.Group();
  copyObjectTransformAndIdentity(group, clone, options);
  clone.name = group.name;
  let childCount = 0;
  group.children.forEach((child) => {
    const exported = cloneObjectForExport(child, options);
    if (!exported) return;
    clone.add(exported);
    childCount += 1;
  });
  if (childCount === 0) return null;
  return clone;
}

/**
 * Clones a content mesh without editor helper children. Geometry is shared
 * unless lightmap UVs are requested, which adds them to a geometry copy;
 * materials are cloned and built-in default surface maps stripped so export
 * stays small and does not embed editor debug textures.
 *
 * @param mesh Live content or solid result mesh.
 * @param options Export behavior switches.
 * @returns Mesh clone without helper children.
 */
function cloneContentMeshForExport(mesh: THREE.Mesh, options: ExportSceneOptions): THREE.Mesh {
  const geometry = options.includeLightmapUvs === true ? LightmapUvLayout.geometryWithLightmapUvs(mesh) : mesh.geometry;
  const clone = new THREE.Mesh(geometry, cloneMaterialsForExport(exportContentMaterialResolve(mesh), options));
  copyObjectTransformAndIdentity(mesh, clone, options);
  clone.userData[EXPORT_STATIC_MESH_EXTRAS_KEY] = true;
  clone.name = mesh.name;
  clone.visible = mesh.visible;
  clone.renderOrder = mesh.renderOrder;
  return clone;
}

/**
 * Clones materials for export and drops non-image canvas maps.
 *
 * @param material Live mesh material or material array.
 * @param options Export behavior switches.
 * @returns Export-safe material(s).
 */
function cloneMaterialsForExport(
  material: THREE.Material | THREE.Material[],
  options: ExportSceneOptions,
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => cloneOneMaterialForExport(entry, options));
  }
  return cloneOneMaterialForExport(material, options);
}

/**
 * Clones one material for GLB export and carries its material identity into
 * export extras. Game-resolved maps are dropped when the options request it.
 *
 * @param material Live material.
 * @param options Export behavior switches.
 * @returns Cloned material safe for GLTFExporter.
 */
function cloneOneMaterialForExport(material: THREE.Material, options: ExportSceneOptions): THREE.Material {
  const cloned = cloneOneMaterialWithoutIdentity(material);
  const materialIdentifier = materialIdentityRead(material);
  cloned.userData = {};
  if (materialIdentifier === null) {
    return cloned;
  }
  cloned.userData[MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY] = materialIdentifier;
  if (options.isMaterialMapResolvedByGame?.(materialIdentifier) === true) {
    clearMaterialMap(cloned);
  }
  return cloned;
}

/**
 * Removes the diffuse map from an export material.
 *
 * @param material Cloned export material.
 */
function clearMaterialMap(material: THREE.Material): void {
  const mapHost = material as THREE.Material & { map?: THREE.Texture | null };
  if (mapHost.map) {
    mapHost.map = null;
    material.needsUpdate = true;
  }
}

/**
 * Clones one material for export. Viewport matcaps convert to standard diffuse
 * materials; canvas debug maps are stripped.
 *
 * @param material Live material.
 * @returns Cloned material safe for GLTFExporter.
 */
function cloneOneMaterialWithoutIdentity(material: THREE.Material): THREE.Material {
  if (isContentViewLitMaterial(material) || material instanceof THREE.MeshMatcapMaterial) {
    return createStandardMaterialFromContent(material);
  }
  const cloned = material.clone();
  clearEditorOnlyMaps(cloned);
  return cloned;
}

/**
 * Builds an export MeshStandardMaterial from a viewport content material.
 *
 * @param material Live content material (view-lit or legacy matcap).
 * @returns Standard material with albedo only.
 */
function createStandardMaterialFromContent(
  material: THREE.Material & {
    color?: THREE.Color;
    map?: THREE.Texture | null;
    flatShading?: boolean;
    side?: THREE.Side;
  },
): THREE.MeshStandardMaterial {
  const map = isEditorOnlySurfaceMap(material.map ?? null) ? null : (material.map ?? null);
  return new THREE.MeshStandardMaterial({
    color: material.color?.clone() ?? new THREE.Color(0xffffff),
    map,
    metalness: CONTENT_METALNESS,
    roughness: CONTENT_ROUGHNESS,
    flatShading: material.flatShading === true,
    side: material.side ?? THREE.FrontSide,
  });
}

/**
 * Nulls editor-only maps so the exporter does not embed the default surface
 * grid.
 *
 * @param material Cloned material to sanitize.
 */
function clearEditorOnlyMaps(material: THREE.Material): void {
  const mapHost = material as THREE.Material & { map?: THREE.Texture | null };
  if (isEditorOnlySurfaceMap(mapHost.map ?? null)) {
    mapHost.map = null;
    material.needsUpdate = true;
  }
}

/**
 * Returns true for maps that must not leave the editor (default grid or
 * canvas).
 *
 * @param map Candidate map.
 * @returns True when the map is editor-only.
 */
function isEditorOnlySurfaceMap(map: THREE.Texture | null): boolean {
  if (!map) {
    return false;
  }
  if (isDefaultSurfaceTexture(map)) {
    return true;
  }
  return map instanceof THREE.CanvasTexture;
}

/**
 * Copies local transform and visibility from source to target, stores the
 * source identifier in the target extras and lets every object data contributor
 * add its extras.
 *
 * @param source Live object.
 * @param target Export object.
 * @param options Export behavior switches.
 */
function copyObjectTransformAndIdentity(
  source: THREE.Object3D,
  target: THREE.Object3D,
  options: ExportSceneOptions,
): void {
  target.position.copy(source.position);
  target.quaternion.copy(source.quaternion);
  target.scale.copy(source.scale);
  target.visible = source.visible;
  target.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] = source.uuid;
  ObjectDataContributorRegistry.exportExtrasWrite(source, target, options);
}
