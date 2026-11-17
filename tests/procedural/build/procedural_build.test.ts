import { describe, expect, it } from 'vitest';
import { materialIdentityRead } from '@/materials/identity/material_identity.js';
import { ProceduralBuild } from '@/procedural/build/procedural_build.js';
import { PROCEDURAL_GENERATOR_BOX_CORNER_B } from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID } from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/** The build step turns settings into parts, materials and a cache key. */
describe('ProceduralBuild', () => {
  const settings = ProceduralSettingsRules.createDefault();

  it('builds the parts of the settings generator, or nothing for an unknown one', () => {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    expect(ProceduralBuild.partsOf(settings)).toEqual(generator?.partsBuild(settings.parameters));
    expect(ProceduralBuild.partsOf({ ...settings, generatorId: 'unknown' })).toBeNull();
  });

  it('changes its key with the parameters and the textures, not otherwise', () => {
    const key = ProceduralBuild.keyOf(settings);
    expect(ProceduralBuild.keyOf(structuredClone(settings))).toBe(key);
    const moved = {
      ...settings,
      parameters: { ...settings.parameters, [PROCEDURAL_GENERATOR_BOX_CORNER_B]: [9, 9, 9] },
    };
    expect(ProceduralBuild.keyOf(moved)).not.toBe(key);
    const retextured = {
      ...settings,
      materials: Object.fromEntries(Object.keys(settings.materials).map((slot) => [slot, 'x'])),
    };
    expect(ProceduralBuild.keyOf(retextured)).not.toBe(key);
  });

  it('creates one material per part carrying the part slot texture', () => {
    const parts = ProceduralBuild.partsOf(settings) ?? [];
    const materials = ProceduralBuild.materialsCreate(parts, settings);
    expect(materials.map((material) => materialIdentityRead(material))).toEqual(
      parts.map((part) => settings.materials[part.materialSlot]),
    );
  });

  it('shows the placeholder of parameters that build nothing, and never exports it', () => {
    const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID);
    if (generator === null) throw new Error('the people mover is built in');
    const steep = {
      ...ProceduralSettingsRules.createForGenerator(generator),
      parameters: generator.parametersSanitize({ start: [0, 0, 0], end: [1, 6, 0] }),
    };
    expect(ProceduralBuild.partsOf(steep)).toEqual([]);
    expect(ProceduralBuild.displayPartsOf(steep)).toEqual(generator.placeholderPartsBuild(steep.parameters));
    expect(ProceduralBuild.displayPartsOf(settings)).toEqual(ProceduralBuild.partsOf(settings));
  });
});
