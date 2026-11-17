import { describe, expect, it } from 'vitest';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_ID,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/**
 * Procedural settings are always valid for their generator and never lose
 * unknown data.
 */
describe('ProceduralSettingsRules', () => {
  const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_BOX_ID);
  if (generator === null) {
    throw new Error('the box generator is built in');
  }

  it('creates the defaults of a generator', () => {
    const settings = ProceduralSettingsRules.createForGenerator(generator);
    expect(settings.generatorId).toBe(generator.generatorId);
    expect(settings.generatorVersion).toBe(generator.version);
    expect(settings.parameters).toEqual(generator.parametersCreateDefault());
    expect(settings.materials).toEqual(generator.materialsSanitize({}));
    expect(ProceduralSettingsRules.createDefault()).toEqual(settings);
  });

  it('reads stored settings, repairing invalid parameters and stamping the current version', () => {
    const defaults = ProceduralSettingsRules.createForGenerator(generator);
    const read = ProceduralSettingsRules.fromUnknown({
      generatorId: generator.generatorId,
      generatorVersion: 0,
      parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_B]: 'far away' },
    });
    expect(read).toEqual(defaults);
  });

  it('refuses values that name no generator', () => {
    expect(ProceduralSettingsRules.fromUnknown(null)).toBeNull();
    expect(ProceduralSettingsRules.fromUnknown('box')).toBeNull();
    expect(ProceduralSettingsRules.fromUnknown({ parameters: {} })).toBeNull();
  });

  it('keeps the parameters of an unknown generator untouched', () => {
    const stored = {
      generatorId: 'escalator_from_the_future',
      generatorVersion: 7,
      parameters: { start: [0, 0, 0], end: [1, 2, 3], speed: 0.75, nested: { a: 1 } },
      materials: { steps: 'metal/grate', broken: 5 },
    };
    const read = ProceduralSettingsRules.fromUnknown(stored);
    expect(read?.generatorId).toBe(stored.generatorId);
    expect(read?.generatorVersion).toBe(stored.generatorVersion);
    expect(read?.parameters).toEqual(stored.parameters);
    expect(read?.materials).toEqual({ steps: 'metal/grate' });
  });
});
