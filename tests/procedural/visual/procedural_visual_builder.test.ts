import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityPickMeshIs, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { materialIdentityRead } from '@/materials/identity/material_identity.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import {
  PROCEDURAL_VISUAL_EDGES_NAME,
  PROCEDURAL_VISUAL_GUIDES_NAME,
  ProceduralVisualBuilder,
} from '@/procedural/visual/procedural_visual_builder.js';
import { PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID } from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/**
 * Returns settings with corner B moved by an offset.
 *
 * @param settings Current settings.
 * @param offset Offset added to corner B.
 * @returns New settings.
 */
function cornerBMoved(settings: ProceduralSettings, offset: THREE.Vector3): ProceduralSettings {
  const cornerB = ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B).add(offset);
  return {
    ...settings,
    parameters: { ...settings.parameters, [PROCEDURAL_GENERATOR_BOX_CORNER_B]: cornerB.toArray() },
  };
}

/**
 * Returns the generated mesh of an owner or fails.
 *
 * @param owner Procedural owner.
 * @returns Its mesh.
 */
function meshOf(owner: THREE.Object3D): THREE.Mesh {
  const mesh = ProceduralVisualBuilder.meshFind(owner);
  if (mesh === null) {
    throw new Error('the owner shows no generated mesh');
  }
  return mesh;
}

/** The editor shows the generated mesh itself, clickable and textured. */
describe('ProceduralVisualBuilder', () => {
  it('shows the generated mesh as the clickable, editor-only marker of the object', () => {
    const owner = ProceduralOwner.createDefault('Box');
    const mesh = meshOf(owner);
    const settings = ProceduralOwner.settingsRead(owner);
    if (settings === null) throw new Error('missing settings');
    expect(entityPickMeshIs(mesh)).toBe(true);
    expect(entityVisualPartIs(mesh)).toBe(true);
    mesh.geometry.computeBoundingBox();
    const expected = new THREE.Box3().setFromPoints([
      ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_A),
      ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B),
    ]);
    expect(mesh.geometry.boundingBox?.equals(expected)).toBe(true);
  });

  it('rebuilds only when the settings change, keeping the same mesh object', () => {
    const owner = ProceduralOwner.createDefault('Box');
    const mesh = meshOf(owner);
    const firstGeometry = mesh.geometry;
    const settings = ProceduralOwner.settingsRead(owner);
    if (settings === null) throw new Error('missing settings');
    ProceduralOwner.settingsWrite(owner, settings);
    expect(meshOf(owner).geometry).toBe(firstGeometry);
    ProceduralOwner.settingsWrite(owner, cornerBMoved(settings, new THREE.Vector3(2, 0, 0)));
    expect(meshOf(owner)).toBe(mesh);
    expect(mesh.geometry).not.toBe(firstGeometry);
  });

  it('outlines the face edges of the mesh without triangle diagonals, after every refresh', () => {
    const owner = ProceduralOwner.createDefault('Box');
    const edgesOf = (): THREE.LineSegments[] =>
      owner.children.filter(
        (child): child is THREE.LineSegments =>
          child instanceof THREE.LineSegments && child.name === PROCEDURAL_VISUAL_EDGES_NAME,
      );
    const boxEdgeCount = 12;
    expect(edgesOf()).toHaveLength(1);
    expect((edgesOf()[0]?.geometry.getAttribute('position').count ?? 0) / 2).toBe(boxEdgeCount);
    const settings = ProceduralOwner.settingsRead(owner);
    if (settings === null) throw new Error('missing settings');
    ProceduralOwner.settingsWrite(owner, settings);
    expect(edgesOf()).toHaveLength(1);
    expect(edgesOf().every((edges) => entityVisualPartIs(edges) && !entityPickMeshIs(edges))).toBe(true);
  });

  it('draws the guide lines a generator asks for as one editor-only part, kept single over refreshes', () => {
    const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID);
    if (generator === null) throw new Error('the people mover is built in');
    const settings = ProceduralSettingsRules.createForGenerator(generator);
    const mover = ProceduralOwner.create('Mover', settings);
    const guidesOf = (owner: THREE.Object3D): THREE.Object3D[] =>
      owner.children.filter((child) => child.name === PROCEDURAL_VISUAL_GUIDES_NAME);
    expect(guidesOf(mover)).toHaveLength(1);
    expect(guidesOf(mover).every((guides) => entityVisualPartIs(guides) && !entityPickMeshIs(guides))).toBe(true);
    const guides = guidesOf(mover)[0];
    const pointCount = guides instanceof THREE.LineSegments ? guides.geometry.getAttribute('position').count : 0;
    expect(pointCount).toBe(generator.guideSegmentsBuild(settings.parameters).length);
    ProceduralOwner.settingsWrite(mover, settings);
    expect(guidesOf(mover)).toHaveLength(1);
    expect(guidesOf(ProceduralOwner.createDefault('Box'))).toEqual([]);
  });

  it('textures every part with its slot texture', () => {
    const owner = ProceduralOwner.createDefault('Box');
    const settings = ProceduralOwner.settingsRead(owner);
    if (settings === null) throw new Error('missing settings');
    const textureId = 'stone/castle_wall';
    ProceduralOwner.settingsWrite(owner, {
      ...settings,
      materials: { ...settings.materials, [PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE]: textureId },
    });
    const materials = meshOf(owner).material;
    const list = Array.isArray(materials) ? materials : [materials];
    expect(list.length).toBe(meshOf(owner).geometry.groups.length);
    expect(list.map((material) => materialIdentityRead(material))).toEqual(list.map(() => textureId));
  });

  it('shows a point marker for a generator the editor does not know', () => {
    const owner = ProceduralOwner.create('Future', {
      generatorId: 'from_a_newer_editor',
      generatorVersion: 3,
      parameters: { start: [0, 0, 0] },
      materials: {},
    });
    expect(ProceduralVisualBuilder.meshFind(owner)).toBeNull();
    expect(ProceduralOwner.markerOf(owner)).not.toBeNull();
    expect(ProceduralOwner.settingsRead(owner)?.parameters).toEqual({ start: [0, 0, 0] });
  });
});
