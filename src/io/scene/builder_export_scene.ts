import * as THREE from 'three';
import { MaterialColorNeutral } from '@/materials/material_color_neutral.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CONTENT_METALNESS, CONTENT_ROUGHNESS } from '@/materials/factory_content_material.js';
import { isContentViewLitMaterial } from '@/materials/factory_content_view_lit_material.js';
import { isDefaultSurfaceTexture } from '@/texture/library/factory_debug_texture.js';
import { entityOwnerIs } from '@/entity/model/entity_owner_keys.js';
import { shouldOmitFromExport } from '@/io/scene/export_object_omission.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';
import { LightmapUvLayout } from '@/io/glb/lightmap/lightmap_uv_layout.js';
import { ExportGeometryMaterialFilter } from '@/io/scene/export_geometry_material_filter.js';
import { MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY, materialIdentityRead } from '@/materials/identity/material_identity.js';
import { exportContentMaterialResolve } from '@/io/scene/export_content_material_resolve.js';
import { objectInOmittedLayerIs } from '@/layer/model/layer_membership.js';
import { DisplacementExportBrushFilter } from '@/displacement/export/displacement_export_brush_filter.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import { displacementSurfaceMeshesUnder } from '@/displacement/mesh/displacement_surface_mesh_keys.js';

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
  /** Writes lights as empty nodes carrying DynLight light extras. */
  includeLightNodes?: boolean;
  /**
   * Writes game entities as empty nodes and every object's game components as
   * `broom_components` extras.
   */
  includeGameComponents?: boolean;
  /** Adds a non-overlapping second UV set (`uv1`) to every mesh for lightmaps. */
  includeLightmapUvs?: boolean;
  /**
   * Returns true for material identifiers whose faces are left out, such as
   * tool textures.
   */
  isMaterialOmitted?: (materialIdentifier: string) => boolean;
  /**
   * Returns true for scene objects that are not drawn, such as volumes: they
   * export as empty nodes that keep their transform, identity and extras.
   */
  isObjectOmitted?: (object: THREE.Object3D) => boolean;
  /** Writes each solid model's collision pieces as `broom_collision` extras. */
  includeCollision?: boolean;
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
  if (options.isObjectOmitted?.(object) === true) return cloneOmittedObjectForExport(object, options);
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
 * Exports an object that is not drawn as an empty node with its transform,
 * identity and extras.
 *
 * @param object Live scene object.
 * @param options Export behavior switches.
 * @returns Empty export node.
 */
function cloneOmittedObjectForExport(object: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D {
  const node = new THREE.Object3D();
  copyObjectTransformAndIdentity(object, node, options);
  node.name = object.name;
  return node;
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
 * Clones a solid model as a group containing the compiled CSG result mesh
 * without the triangles of displaced brushes, plus one mesh per displacement
 * surface. The result mesh is left out when displaced brushes leave it without
 * triangles.
 *
 * @param solidRoot Solid model root group.
 * @param options Export behavior switches.
 * @returns Export group, or null when no result exists.
 */
function cloneSolidModelForExport(solidRoot: THREE.Object3D, options: ExportSceneOptions): THREE.Group | null {
  const resultMesh = findSolidResultMesh(solidRoot);
  if (!resultMesh) return null;
  const group = new THREE.Group();
  copyObjectTransformAndIdentity(solidRoot, group, options);
  group.name = solidRoot.name || 'SolidModel';
  const resultGeometry = DisplacementExportBrushFilter.geometryRead(resultMesh, solidRoot);
  const meshes = [
    resultGeometry === resultMesh.geometry || getTriangleCount(resultGeometry) > 0
      ? identityDerive(cloneContentMeshForExport(resultMesh, options, resultGeometry), solidRoot, 'result')
      : null,
    ...displacementSurfaceMeshesUnder(solidRoot).map((surfaceMesh) =>
      identityDerive(cloneContentMeshForExport(surfaceMesh, options), solidRoot, surfaceMesh.name),
    ),
  ];
  meshes.forEach((mesh) => (mesh ? group.add(mesh) : undefined));
  return group;
}

/**
 * Gives an export mesh made by a solid model an identifier derived from the
 * model's, because the meshes a model builds get new ids every time it loads.
 *
 * @param mesh Export mesh, or null.
 * @param solidRoot Solid model root.
 * @param part Name of the part within the model.
 * @returns The same mesh.
 */
function identityDerive(mesh: THREE.Mesh | null, solidRoot: THREE.Object3D, part: string): THREE.Mesh | null {
  if (mesh) {
    mesh.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] = `${solidRoot.uuid}.${part}`;
  }
  return mesh;
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
 * @param sourceGeometry Geometry to export for the mesh; defaults to the mesh's
 *   own geometry.
 * @returns Mesh clone without helper children, or null when the options leave
 *   out every face.
 */
export function cloneContentMeshForExport(
  mesh: THREE.Mesh,
  options: ExportSceneOptions,
  sourceGeometry: THREE.BufferGeometry = mesh.geometry,
): THREE.Mesh | null {
  const keptGeometry = options.isMaterialOmitted
    ? ExportGeometryMaterialFilter.filter(sourceGeometry, exportContentMaterialResolve(mesh), options.isMaterialOmitted)
    : sourceGeometry;
  if (keptGeometry === null) return null;
  const geometry =
    options.includeLightmapUvs === true ? LightmapUvLayout.geometryWithLightmapUvs(mesh, keptGeometry) : keptGeometry;
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
    color: material.color?.clone() ?? new THREE.Color(MaterialColorNeutral.white),
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
