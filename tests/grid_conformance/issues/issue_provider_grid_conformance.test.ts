import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ISSUE_PROVIDER_GRID_CONFORMANCE_ID,
  IssueProviderGridConformance,
} from '@/grid_conformance/issues/issue_provider_grid_conformance.js';
import { issueProvidersBuiltin } from '@/info_panel/issues/issue_provider_builtin.js';
import { GRID_TEST_OFF_GRID_OFFSET, gridTestBrushAdd } from '../grid_conformance_test_scene.js';

/** Proves off-grid brushes show up as warnings in the Issues list. */
describe('IssueProviderGridConformance', () => {
  it('warns about an off-grid brush and points at its mesh', () => {
    const world = new THREE.Group();
    gridTestBrushAdd(world, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
    const { brush } = gridTestBrushAdd(
      world,
      new THREE.Vector3(GRID_TEST_OFF_GRID_OFFSET, 0, 0),
      new THREE.Vector3(1, 1, 1),
    );
    const issues = new IssueProviderGridConformance().collect(world);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectUuid).toBe(brush.mesh?.uuid);
    expect(issues[0]?.providerId).toBe(ISSUE_PROVIDER_GRID_CONFORMANCE_ID);
  });

  it('is one of the built-in issue providers', () => {
    expect(issueProvidersBuiltin().map((provider) => provider.id)).toContain(ISSUE_PROVIDER_GRID_CONFORMANCE_ID);
  });
});
