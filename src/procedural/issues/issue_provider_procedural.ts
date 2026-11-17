import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';

/** Identifier of the procedural object check. */
export const ISSUE_PROVIDER_PROCEDURAL_ID = 'procedural';

/**
 * Reports procedural objects whose generator the editor does not know, and
 * objects whose parameters their generator refuses to build.
 */
export class IssueProviderProcedural extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_PROCEDURAL_ID, 'Procedural objects');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    for (const owner of ProceduralOwner.collectUnder(worldGroup)) {
      const settings = ProceduralOwner.settingsRead(owner);
      if (settings !== null) {
        issues.push(...this.ownerIssuesCollect(owner, settings));
      }
    }
    return issues;
  }

  /**
   * Checks one procedural object.
   *
   * @param owner Procedural owner.
   * @param settings Its valid settings.
   * @returns A warning for an unknown generator, else one error per refused
   *   parameter.
   */
  private ownerIssuesCollect(owner: THREE.Object3D, settings: ProceduralSettings): Issue[] {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    if (generator === null) {
      return [
        this.issueCreate({
          severity: 'warning',
          objectUuid: owner.uuid,
          objectName: owner.name,
          description: `Procedural generator ${settings.generatorId} is not known to this editor; nothing is built or exported`,
        }),
      ];
    }
    return generator
      .issuesDescribe(settings.parameters)
      .map((description) =>
        this.issueCreate({ severity: 'error', objectUuid: owner.uuid, objectName: owner.name, description }),
      );
  }
}
