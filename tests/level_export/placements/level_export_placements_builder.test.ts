import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LevelExportPlacementsBuilder } from '@/level_export/placements/level_export_placements_builder.js';
import { PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH } from '@/procedural/export/procedural_export_component.js';
import {
  PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
  PROCEDURAL_PEOPLE_MOVER_END,
  PROCEDURAL_PEOPLE_MOVER_START,
} from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/**
 * Creates an escalator between two local ends under a moved and turned parent.
 *
 * @returns World, escalator and its local ends.
 */
function escalatorWorldCreate(): { world: THREE.Group; mover: THREE.Group; start: THREE.Vector3; end: THREE.Vector3 } {
  const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID);
  if (generator === null) throw new Error('the people mover is built in');
  const start = new THREE.Vector3(0, 0, 0);
  const end = new THREE.Vector3(6, 3, 0);
  const settings = ProceduralSettingsRules.createForGenerator(generator);
  const mover = ProceduralOwner.create('Escalator', {
    ...settings,
    parameters: generator.parametersSanitize({
      ...settings.parameters,
      [PROCEDURAL_PEOPLE_MOVER_START]: start.toArray(),
      [PROCEDURAL_PEOPLE_MOVER_END]: end.toArray(),
    }),
  });
  const parent = new THREE.Group();
  parent.position.set(10, 1, -4);
  parent.rotation.set(0, Math.PI / 2, 0);
  mover.position.set(1, 0, 2);
  parent.add(mover);
  const world = new THREE.Group();
  world.add(parent);
  world.updateMatrixWorld(true);
  return { world, mover, start, end };
}

/** Placements list what the game places itself, in world space. */
describe('LevelExportPlacementsBuilder', () => {
  it('lists game entities and objects with components, with world transforms, and skips plain objects', () => {
    const world = new THREE.Group();
    const entity = GameEntityOwner.createDefault('Spawn');
    entity.position.set(3, 1, -2);
    const crate = new THREE.Group();
    GameEntityComponentStore.write(crate, { 'game::Pickup': { amount: 2 } });
    world.add(entity, crate, new THREE.Group());
    world.updateMatrixWorld(true);
    const placements = LevelExportPlacementsBuilder.build(world);
    expect(placements.map((placement) => [placement.object_id, placement.kind])).toEqual([
      [entity.uuid, 'game_entity'],
      [crate.uuid, 'object'],
    ]);
    expect(placements[0]?.position).toEqual([3, 1, -2]);
    expect(placements[1]?.components).toEqual({ 'game::Pickup': { amount: 2 } });
  });

  it('gives a people mover its parameters, its derived values and its ends in world space', () => {
    const { world, mover, start, end } = escalatorWorldCreate();
    const placement = LevelExportPlacementsBuilder.build(world).find((candidate) => candidate.object_id === mover.uuid);
    expect(placement?.kind).toBe('procedural');
    expect(placement?.components[PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH]?.['generator']).toBe(
      PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
    );
    expect(placement?.procedural?.derived['shape']).toBe('escalator');
    const lowWorld = new THREE.Vector3(...(placement?.procedural?.derived_points_world['low_end'] ?? []));
    const highWorld = new THREE.Vector3(...(placement?.procedural?.derived_points_world['high_end'] ?? []));
    expect(lowWorld.distanceTo(mover.localToWorld(start.clone()))).toBeLessThan(1e-5);
    expect(highWorld.distanceTo(mover.localToWorld(end.clone()))).toBeLessThan(1e-5);
  });

  /**
   * The game builds a mover's colliders from the parts the editor draws, so
   * every drawn part is exported in world space with its role, and the deck and
   * sides cover the mover exactly as its mesh does.
   */
  it('exports every part of a people mover in world space with its role', () => {
    const { world, mover } = escalatorWorldCreate();
    const placement = LevelExportPlacementsBuilder.build(world).find((candidate) => candidate.object_id === mover.uuid);
    const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID);
    const settings = ProceduralOwner.settingsRead(mover);
    if (generator === null || settings === null) throw new Error('the escalator has settings');
    const parts = generator.partsBuild(settings.parameters);
    const exported = placement?.procedural?.parts_world ?? [];
    expect(exported.map((part) => part.name)).toEqual(parts.map((part) => part.name));
    expect(new Set(exported.map((part) => part.role))).toEqual(new Set(['deck', 'side', 'step']));
    parts.forEach((part, index) => {
      const worldBox = new THREE.Box3().setFromPoints(
        part.faces.flat().map((corner) => mover.localToWorld(corner.clone())),
      );
      const exportedBox = new THREE.Box3().setFromPoints(
        (exported[index]?.points ?? []).map((point) => new THREE.Vector3(...point)),
      );
      expect(exportedBox.min.distanceTo(worldBox.min)).toBeLessThan(1e-4);
      expect(exportedBox.max.distanceTo(worldBox.max)).toBeLessThan(1e-4);
    });
  });
});
