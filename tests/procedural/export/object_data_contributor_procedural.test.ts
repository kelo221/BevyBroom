import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GAME_ENTITY_EXPORT_EXTRAS_KEY } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import {
  EXPORT_OBJECT_IDENTITY_EXTRAS_KEY,
  EXPORT_STATIC_MESH_EXTRAS_KEY,
  buildExportScene,
} from '@/io/scene/builder_export_scene.js';
import { entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY } from '@/materials/identity/material_identity.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH } from '@/procedural/export/procedural_export_component.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { PreviewGeometrySignature } from '@/preview/geometry/preview_geometry_signature.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';

/** Game component a level designer attached to the object. */
const GAME_COMPONENT_TYPE_PATH = 'my_game::level::Escalator';

/**
 * Creates a world holding one textured box placed away from the origin.
 *
 * @returns World and box owner.
 */
function worldWithBox(): { world: THREE.Group; owner: THREE.Group } {
  const world = new THREE.Group();
  const owner = ProceduralOwner.createDefault('Crate');
  const settings = ProceduralOwner.settingsRead(owner);
  if (settings === null) throw new Error('missing settings');
  ProceduralOwner.settingsWrite(owner, {
    ...settings,
    materials: { [PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE]: 'wood/crate' },
  });
  owner.position.set(4, 0, -3);
  world.add(owner);
  return { world, owner };
}

/**
 * Returns the export node of an owner.
 *
 * @param exported Export root.
 * @param owner Live owner.
 * @returns Export node carrying the owner's identity.
 */
function exportNodeOf(exported: THREE.Object3D, owner: THREE.Object3D): THREE.Object3D {
  const node = exported.children.find((child) => child.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === owner.uuid);
  if (!node) throw new Error('the owner is not exported');
  return node;
}

/**
 * Procedural objects reach exports and the game preview as meshes plus
 * parameters.
 */
describe('ObjectDataContributorProcedural', () => {
  it('exports one static, textured mesh per part under the owner node, without editor helpers', () => {
    const { world, owner } = worldWithBox();
    const node = exportNodeOf(buildExportScene(world), owner);
    const settings = ProceduralOwner.settingsRead(owner);
    const parts = settings
      ? (ProceduralGeneratorRegistry.find(settings.generatorId)?.partsBuild(settings.parameters) ?? [])
      : [];
    expect(node.position.toArray()).toEqual(owner.position.toArray());
    expect(node.children.map((child) => child.name)).toEqual(parts.map((part) => part.name));
    for (const child of node.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
      expect(child.userData[EXPORT_STATIC_MESH_EXTRAS_KEY]).toBe(true);
      expect(entityVisualPartIs(child)).toBe(false);
      const materials = (child as THREE.Mesh).material;
      const first = Array.isArray(materials) ? materials[0] : materials;
      expect(first?.userData[MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY]).toBe('wood/crate');
    }
  });

  it('exports the same nodes, extras and vertices every time', () => {
    const { world } = worldWithBox();
    const exportDescribe = (): string => {
      const parts: unknown[] = [];
      buildExportScene(world, { includeGameComponents: true }).traverse((node) => {
        const positions = node instanceof THREE.Mesh ? Array.from(node.geometry.getAttribute('position').array) : [];
        parts.push([node.name, node.userData, positions]);
      });
      return JSON.stringify(parts);
    };
    expect(exportDescribe()).toBe(exportDescribe());
  });

  it('writes BroomProceduralProp beside the game components the designer attached', () => {
    const { world, owner } = worldWithBox();
    GameEntityComponentStore.write(owner, { [GAME_COMPONENT_TYPE_PATH]: { belt: 0.5 } });
    const node = exportNodeOf(buildExportScene(world, { includeGameComponents: true }), owner);
    const components = node.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] as Record<string, Record<string, unknown>>;
    expect(components[GAME_COMPONENT_TYPE_PATH]).toEqual({ belt: 0.5 });
    const settings = ProceduralOwner.settingsRead(owner);
    expect(components[PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH]?.['generator']).toBe(settings?.generatorId);
    expect(JSON.parse(String(components[PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH]?.['parameters']))).toEqual(
      settings?.parameters,
    );
    const withoutComponents = exportNodeOf(buildExportScene(world), owner);
    expect(withoutComponents.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY]).toBeUndefined();
  });

  it('sends BroomProceduralProp to the game preview with the other components', () => {
    const { owner } = worldWithBox();
    GameEntityComponentStore.write(owner, { [GAME_COMPONENT_TYPE_PATH]: { belt: 1 } });
    const authored = { id: owner.uuid } as PreviewAuthoredObject;
    ObjectDataContributorRegistry.previewPayloadAttach(owner, authored);
    expect(Object.keys(authored.components ?? {}).sort()).toEqual(
      [GAME_COMPONENT_TYPE_PATH, PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH].sort(),
    );
  });

  it('changes the preview geometry signature exactly when the generated mesh changes', () => {
    const { world, owner } = worldWithBox();
    const before = PreviewGeometrySignature.compute(world);
    owner.position.x += 1;
    expect(PreviewGeometrySignature.compute(world)).toBe(before);
    const settings = ProceduralOwner.settingsRead(owner);
    if (settings === null) throw new Error('missing settings');
    ProceduralOwner.settingsWrite(owner, {
      ...settings,
      parameters: { ...settings.parameters, [PROCEDURAL_GENERATOR_BOX_CORNER_B]: [3, 3, 3] },
    });
    expect(PreviewGeometrySignature.compute(world)).not.toBe(before);
  });
});
