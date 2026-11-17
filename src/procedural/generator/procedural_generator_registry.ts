import { ProceduralGeneratorBox } from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorPeopleMover } from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import type { ProceduralGenerator } from '@/procedural/generator/procedural_generator.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Returns the generators the editor ships with.
 *
 * @returns Generators in menu order.
 */
function proceduralGeneratorsBuiltinCreate(): readonly ProceduralGenerator[] {
  return [new ProceduralGeneratorBox(), new ProceduralGeneratorPeopleMover()];
}

/**
 * Finds procedural generators by identifier: the generators the editor ships
 * with and generators features register at runtime. The first generator of an
 * identifier wins.
 */
export class ProceduralGeneratorRegistry {
  private static readonly generators = new RegistryExtensible<ProceduralGenerator>(proceduralGeneratorsBuiltinCreate);

  /**
   * Adds a generator. A generator whose identifier is already registered is
   * ignored.
   *
   * @param generator Generator to add.
   */
  static register(generator: ProceduralGenerator): void {
    if (ProceduralGeneratorRegistry.find(generator.generatorId) !== null) {
      return;
    }
    ProceduralGeneratorRegistry.generators.register(generator);
  }

  /**
   * Removes a generator added with {@link register}.
   *
   * @param generator Generator to remove.
   */
  static unregister(generator: ProceduralGenerator): void {
    ProceduralGeneratorRegistry.generators.unregister(generator);
  }

  /**
   * Returns every generator: the built-in ones first, then registered ones.
   *
   * @returns Generators in menu order.
   */
  static list(): readonly ProceduralGenerator[] {
    return ProceduralGeneratorRegistry.generators.list();
  }

  /**
   * Returns the generator with an identifier.
   *
   * @param generatorId Candidate identifier.
   * @returns The generator, or null when none has that identifier.
   */
  static find(generatorId: string): ProceduralGenerator | null {
    return ProceduralGeneratorRegistry.list().find((generator) => generator.generatorId === generatorId) ?? null;
  }
}
