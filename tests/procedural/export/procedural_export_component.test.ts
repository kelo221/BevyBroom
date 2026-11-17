import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GAME_ENTITY_EXPORT_EXTRAS_KEY } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import { buildExportScene, EXPORT_OBJECT_IDENTITY_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import {
  PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH,
  ProceduralExportComponent,
} from '@/procedural/export/procedural_export_component.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/**
 * Reads the shared procedural prop sample the bridge's tests read too.
 *
 * @returns The sample node extras.
 */
function sampleRead(): Record<string, Record<string, Record<string, unknown>>> {
  return JSON.parse(readFileSync(join(process.cwd(), 'bevy/fixtures/procedural_prop_sample.json'), 'utf8'));
}

/** The editor writes the component the game reads, matching the shared sample. */
describe('ProceduralExportComponent', () => {
  it('writes exactly the node extras of the bridge sample for the sample box', () => {
    const sample = sampleRead();
    const fields = sample[GAME_ENTITY_EXPORT_EXTRAS_KEY]?.[PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH] ?? {};
    const settings = ProceduralSettingsRules.fromUnknown({
      generatorId: fields['generator'],
      parameters: JSON.parse(String(fields['parameters'])),
    });
    if (settings === null) throw new Error('the sample names a generator');
    const world = new THREE.Group();
    const owner = ProceduralOwner.create('Sample Box', settings);
    world.add(owner);
    const node = buildExportScene(world, { includeGameComponents: true }).children.find(
      (child) => child.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === owner.uuid,
    );
    expect({ [GAME_ENTITY_EXPORT_EXTRAS_KEY]: node?.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] }).toEqual(sample);
  });

  it('keeps components the object already carries', () => {
    const settings = ProceduralSettingsRules.createDefault();
    const merged = ProceduralExportComponent.componentsMerge({ 'game::Door': { open: true } }, settings);
    expect(merged['game::Door']).toEqual({ open: true });
    expect(merged[PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH]).toEqual(ProceduralExportComponent.fieldsCreate(settings));
  });
});
