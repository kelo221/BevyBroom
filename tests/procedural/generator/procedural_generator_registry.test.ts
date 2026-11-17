import { afterEach, describe, expect, it } from 'vitest';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { PROCEDURAL_GENERATOR_BOX_ID } from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGenerator, type ProceduralMaterialSlot } from '@/procedural/generator/procedural_generator.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** A generator a feature might register: it builds nothing. */
class ProceduralGeneratorTestEmpty extends ProceduralGenerator {
  readonly generatorId: string;
  readonly label = 'Empty';
  readonly version = 1;
  readonly iconName: IconName = 'puzzle';

  /**
   * Creates the generator.
   *
   * @param generatorId Identifier to register under.
   */
  constructor(generatorId: string) {
    super();
    this.generatorId = generatorId;
  }

  /** @returns No fields. */
  fields(): readonly GameEntityField[] {
    return [];
  }

  /** @returns No slots. */
  materialSlots(): readonly ProceduralMaterialSlot[] {
    return [];
  }

  /** @returns No parts. */
  partsBuild(): ProceduralPart[] {
    return [];
  }
}

const registered: ProceduralGenerator[] = [];

afterEach(() => {
  registered.splice(0).forEach((generator) => ProceduralGeneratorRegistry.unregister(generator));
});

/** Generators are found by identifier and features can add their own. */
describe('ProceduralGeneratorRegistry', () => {
  it('ships the box generator', () => {
    expect(ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_BOX_ID)?.generatorId).toBe(
      PROCEDURAL_GENERATOR_BOX_ID,
    );
    expect(ProceduralGeneratorRegistry.find('no-such-generator')).toBeNull();
  });

  it('adds registered generators after the built-in ones and ignores duplicate identifiers', () => {
    const added = new ProceduralGeneratorTestEmpty('test-empty');
    registered.push(added);
    ProceduralGeneratorRegistry.register(added);
    ProceduralGeneratorRegistry.register(new ProceduralGeneratorTestEmpty(PROCEDURAL_GENERATOR_BOX_ID));
    const list = ProceduralGeneratorRegistry.list();
    expect(list.at(-1)).toBe(added);
    expect(list.filter((generator) => generator.generatorId === PROCEDURAL_GENERATOR_BOX_ID)).toHaveLength(1);
    expect(ProceduralGeneratorRegistry.find('test-empty')).toBe(added);
  });
});
