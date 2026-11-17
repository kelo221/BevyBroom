import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_ID,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { PROCEDURAL_ENTITY_KIND, PROCEDURAL_POINT_CLASS_PREFIX } from '@/procedural/model/procedural_definition.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

const definition = ProceduralOwner.definition;

/** Procedural objects are an entity kind like lights and rooms. */
describe('ProceduralDefinition', () => {
  it('is a registered entity kind', () => {
    expect(EntityOwnerRegistry.findByKind(PROCEDURAL_ENTITY_KIND)).toBe(ProceduralOwner);
  });

  it('is resized through handles, never scaled', () => {
    expect(definition.transformScaleAllowed()).toBe(false);
    expect(definition.boundsResizable()).toBe(false);
    expect(definition.scaleAbsorbs()).toBe(false);
  });

  it('shows one handle per point field of the generator', () => {
    const settings = definition.settingsCreateDefault();
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    expect(definition.handlesCreate(settings).map((handle) => handle.handleName)).toEqual(
      generator?.handlePointPaths(),
    );
  });

  it('merges parameter patches over the current parameters', () => {
    const settings = definition.settingsCreateDefault();
    const moved = [5, 6, 7];
    const patched = definition.settingsFromUnknown(
      definition.settingsPatch(settings, { parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_B]: moved } }),
    );
    expect(patched?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B]).toEqual(moved);
    expect(patched?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_A]).toEqual(
      settings.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_A],
    );
  });

  it('offers one point class per generator that keeps the settings of its own generator', () => {
    const variants = definition.pointClassVariants();
    expect(variants.map((variant) => variant.id)).toEqual(
      ProceduralGeneratorRegistry.list().map((generator) => `${PROCEDURAL_POINT_CLASS_PREFIX}${generator.generatorId}`),
    );
    const boxVariant = variants.find((variant) => variant.id.endsWith(PROCEDURAL_GENERATOR_BOX_ID));
    const edited = {
      ...definition.settingsCreateDefault(),
      parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_B]: [3, 3, 3] },
    };
    expect(boxVariant?.settingsMatch(edited)).toBe(true);
    expect(boxVariant?.settingsCreate(edited)).toBe(edited);
    expect(boxVariant?.settingsCreate(null)).toEqual(ProceduralSettingsRules.createDefault());
  });

  it('creates owners whose settings survive a write and read', () => {
    const owner = ProceduralOwner.createDefault('Box');
    const settings = ProceduralOwner.settingsRead(owner);
    expect(settings).toEqual(definition.settingsCreateDefault());
    expect(ProceduralOwner.isOwner(owner)).toBe(true);
    expect(ProceduralOwner.isOwner(new THREE.Group())).toBe(false);
  });
});
