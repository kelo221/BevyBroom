import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IssueProviderProcedural } from '@/procedural/issues/issue_provider_procedural.js';
import { ProceduralGeneratorBox } from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/** Problem every object of the refusing test generator reports. */
const REFUSED_DESCRIPTION = 'This box is refused';

/** A box generator that refuses every parameter set. */
class ProceduralGeneratorTestRefusing extends ProceduralGeneratorBox {
  override readonly generatorId = 'test-refusing-box';

  /**
   * Refuses every parameter set.
   *
   * @param _parameters Valid parameters.
   * @returns One problem.
   */
  override issuesDescribe(_parameters: ProceduralParameters): string[] {
    return [REFUSED_DESCRIPTION];
  }
}

const refusing = new ProceduralGeneratorTestRefusing();

afterEach(() => {
  ProceduralGeneratorRegistry.unregister(refusing);
});

/** The Issues list names procedural objects that cannot be built. */
describe('IssueProviderProcedural', () => {
  it('reports nothing for a valid box', () => {
    const world = new THREE.Group();
    world.add(ProceduralOwner.createDefault('Box'));
    expect(new IssueProviderProcedural().collect(world)).toEqual([]);
  });

  it('warns about a generator the editor does not know', () => {
    const world = new THREE.Group();
    const owner = ProceduralOwner.create('Future', {
      generatorId: 'from_a_newer_editor',
      generatorVersion: 1,
      parameters: {},
      materials: {},
    });
    world.add(owner);
    const issues = new IssueProviderProcedural().collect(world);
    expect(issues.map((issue) => [issue.severity, issue.objectUuid])).toEqual([['warning', owner.uuid]]);
    expect(issues[0]?.description).toContain('from_a_newer_editor');
  });

  it('reports the problems a generator describes as errors', () => {
    ProceduralGeneratorRegistry.register(refusing);
    const world = new THREE.Group();
    const owner = ProceduralOwner.create('Refused', ProceduralSettingsRules.createForGenerator(refusing));
    world.add(owner);
    const issues = new IssueProviderProcedural().collect(world);
    expect(issues.map((issue) => [issue.severity, issue.objectUuid, issue.description])).toEqual([
      ['error', owner.uuid, REFUSED_DESCRIPTION],
    ]);
  });
});
