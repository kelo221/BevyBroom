import { PROCEDURAL_GENERATOR_BOX_ID } from '@/procedural/generator/box/procedural_generator_box.js';
import type { ProceduralGenerator } from '@/procedural/generator/procedural_generator.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import type {
  ProceduralMaterials,
  ProceduralParameters,
  ProceduralSettings,
} from '@/procedural/model/procedural_settings.js';

/**
 * Creates, validates and reads procedural object settings. Settings of a
 * generator the editor does not know keep their parameters untouched, so a file
 * from a newer editor loses nothing.
 */
export class ProceduralSettingsRules {
  /**
   * Returns the settings of a new object built by a generator.
   *
   * @param generator Generator of the object.
   * @returns Fresh settings with every default.
   */
  static createForGenerator(generator: ProceduralGenerator): ProceduralSettings {
    return {
      generatorId: generator.generatorId,
      generatorVersion: generator.version,
      parameters: generator.parametersCreateDefault(),
      materials: generator.materialsSanitize({}),
    };
  }

  /**
   * Returns the settings of a new two-corner box.
   *
   * @returns Fresh settings.
   */
  static createDefault(): ProceduralSettings {
    const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_BOX_ID);
    if (generator === null) {
      return { generatorId: PROCEDURAL_GENERATOR_BOX_ID, generatorVersion: 1, parameters: {}, materials: {} };
    }
    return ProceduralSettingsRules.createForGenerator(generator);
  }

  /**
   * Returns settings whose parameters and materials satisfy their generator,
   * with parameters of an older layout version migrated first.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  static sanitize(settings: ProceduralSettings): ProceduralSettings {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    if (generator === null) {
      return ProceduralSettingsRules.sanitizeUnknownGenerator(settings);
    }
    return {
      generatorId: generator.generatorId,
      generatorVersion: generator.version,
      parameters: generator.parametersSanitize(ProceduralSettingsRules.parametersMigrated(generator, settings)),
      materials: generator.materialsSanitize(settings.materials),
    };
  }

  /**
   * Returns the parameters in the generator's current layout.
   *
   * @param generator Generator of the settings.
   * @param settings Possibly invalid settings.
   * @returns The parameters, migrated when they were written for an older
   *   layout version.
   */
  private static parametersMigrated(
    generator: ProceduralGenerator,
    settings: ProceduralSettings,
  ): Readonly<Record<string, unknown>> {
    return settings.generatorVersion < generator.version
      ? generator.parametersMigrate(settings.parameters, settings.generatorVersion)
      : settings.parameters;
  }

  /**
   * Reads untrusted data, such as a scene file entry, into valid settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value is not an object naming a
   *   generator.
   */
  static fromUnknown(value: unknown): ProceduralSettings | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (typeof record['generatorId'] !== 'string' || record['generatorId'] === '') {
      return null;
    }
    return ProceduralSettingsRules.sanitize({
      generatorId: record['generatorId'],
      generatorVersion: typeof record['generatorVersion'] === 'number' ? record['generatorVersion'] : 0,
      parameters: ProceduralSettingsRules.recordRead(record['parameters']) as ProceduralParameters,
      materials: ProceduralSettingsRules.recordRead(record['materials']) as ProceduralMaterials,
    });
  }

  /**
   * Returns settings of an unknown generator as they are, with only the texture
   * names kept from the materials.
   *
   * @param settings Settings of an unknown generator.
   * @returns Settings safe to store.
   */
  private static sanitizeUnknownGenerator(settings: ProceduralSettings): ProceduralSettings {
    const materials: ProceduralMaterials = {};
    for (const [slot, textureId] of Object.entries(ProceduralSettingsRules.recordRead(settings.materials))) {
      if (typeof textureId === 'string') {
        materials[slot] = textureId;
      }
    }
    const parameters = ProceduralSettingsRules.recordRead(settings.parameters) as ProceduralParameters;
    return { ...settings, parameters: structuredClone(parameters), materials };
  }

  /**
   * Returns a value as a plain record.
   *
   * @param value Any value.
   * @returns The value when it is a non-list object, else an empty record.
   */
  private static recordRead(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
