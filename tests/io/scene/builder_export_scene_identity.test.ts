import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  EXPORT_OBJECT_IDENTITY_EXTRAS_KEY,
  EXPORT_STATIC_MESH_EXTRAS_KEY,
  buildExportScene,
} from '@/io/scene/builder_export_scene.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { glbJsonRead } from '../glb/glb_json_read.js';
import { LightOwner } from '@/light/model/light_owner.js';
import {
  MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY,
  materialIdentityRead,
  materialIdentityWrite,
} from '@/materials/identity/material_identity.js';
import { rebuildSurfaceMaterials } from '@/texture/material/builder_surface_material.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';

/**
 * Creates a mesh whose material carries a material identity and a diffuse map.
 *
 * @param materialIdentifier Identity stamped on the material.
 * @returns Content-like mesh.
 */
function createIdentifiedMesh(materialIdentifier: string): THREE.Mesh {
  const texture = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture });
  materialIdentityWrite(material, materialIdentifier);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = 'Wall';
  return mesh;
}

/**
 * Exports carry stable object identifiers, material identities and baking
 * flags, and never contain editor-only lights.
 */
describe('export scene identity', () => {
  it('stores the editor identifier on every node and marks meshes static', () => {
    const world = new THREE.Group();
    const group = new THREE.Group();
    const mesh = createIdentifiedMesh('stone/wall');
    group.add(mesh);
    world.add(group);
    const exported = buildExportScene(world);
    const exportedGroup = exported.children[0];
    const exportedMesh = exportedGroup?.children[0];
    expect(exportedGroup?.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY]).toBe(group.uuid);
    expect(exportedMesh?.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY]).toBe(mesh.uuid);
    expect(exportedMesh?.userData[EXPORT_STATIC_MESH_EXTRAS_KEY]).toBe(true);
  });

  it('omits light owners and their visuals', () => {
    const world = new THREE.Group();
    world.add(LightOwner.createDefault('Lamp', 'spot'));
    world.add(createIdentifiedMesh('stone/wall'));
    const exported = buildExportScene(world);
    expect(exported.children).toHaveLength(1);
    expect(exported.children[0]?.name).toBe('Wall');
  });

  it('writes identifiers and material identities into the GLB extras', async () => {
    const world = new THREE.Group();
    const mesh = createIdentifiedMesh('stone/wall');
    world.add(mesh);
    const json = glbJsonRead(await new GlbExporter().export(world, null, { isMaterialMapResolvedByGame: () => true }));
    const meshNode = json.nodes?.find((node) => node.name === 'Wall');
    expect(meshNode?.extras?.[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY]).toBe(mesh.uuid);
    expect(json.materials?.[0]?.extras?.[MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY]).toBe('stone/wall');
  });

  it('drops maps of game-resolved materials and keeps the others', () => {
    const world = new THREE.Group();
    world.add(createIdentifiedMesh('stone/wall'), createIdentifiedMesh('editor/only'));
    const exported = buildExportScene(world, {
      isMaterialMapResolvedByGame: (identifier) => identifier === 'stone/wall',
    });
    const maps = exported.children.map((child) => {
      const material = child instanceof THREE.Mesh ? child.material : null;
      return material instanceof THREE.MeshStandardMaterial ? material.map : undefined;
    });
    expect(maps[0]).toBeNull();
    expect(maps[1]).toBeInstanceOf(THREE.Texture);
  });

  it('stamps the texture identity on rebuilt surface materials', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    initializeMeshTextureUVs(mesh, DEFAULT_CHECKER_TEXTURE_ID);
    rebuildSurfaceMaterials(mesh);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    expect(materials.length).toBeGreaterThan(0);
    materials.forEach((material) => expect(materialIdentityRead(material)).toBe(DEFAULT_CHECKER_TEXTURE_ID));
  });
});
