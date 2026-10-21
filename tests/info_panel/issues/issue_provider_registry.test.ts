import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { IssueProviderRegistry } from '@/info_panel/issues/issue_provider_registry.js';
import { issuesTestSolidModelAdd, issuesTestWorldCreate } from './issues_test_world.js';

/** Test provider reporting one issue on every named object. */
class IssueProviderTestNamed extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super('test_named', 'Named objects');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    return worldGroup.children
      .filter((child) => child.name.startsWith('flagged'))
      .map((child) =>
        this.issueCreate({ severity: 'error', objectUuid: child.uuid, objectName: child.name, description: 'Flagged' }),
      );
  }
}

/**
 * Unit tests for the issue provider registry: built-in providers run first,
 * registered providers plug in and can be removed again.
 */
describe('IssueProviderRegistry', () => {
  it('lists the built-in providers with unique ids', () => {
    const ids = IssueProviderRegistry.providersList().map((provider) => provider.id);
    expect(ids).toEqual(
      expect.arrayContaining(['solid_brush_invalid', 'solid_model_warnings', 'game_component_unknown']),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('collects the issues of the built-in and registered providers until it is removed', () => {
    const testWorld = issuesTestWorldCreate();
    issuesTestSolidModelAdd(testWorld, 'Empty', false);
    const flagged = new THREE.Object3D();
    flagged.name = 'flagged object';
    testWorld.world.add(flagged);
    const provider = new IssueProviderTestNamed();
    IssueProviderRegistry.register(provider);
    try {
      const issues = IssueProviderRegistry.issuesCollect(testWorld.world);
      expect(issues.map((issue) => issue.providerId)).toEqual(['solid_model_warnings', 'test_named']);
      expect(issues[1]?.objectUuid).toBe(flagged.uuid);
    } finally {
      IssueProviderRegistry.unregister(provider);
    }
    expect(IssueProviderRegistry.issuesCollect(testWorld.world).map((issue) => issue.providerId)).toEqual([
      'solid_model_warnings',
    ]);
  });
});
