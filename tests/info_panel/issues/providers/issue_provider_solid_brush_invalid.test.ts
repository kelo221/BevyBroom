import { describe, expect, it } from 'vitest';
import { IssueProviderSolidBrushInvalid } from '@/info_panel/issues/providers/issue_provider_solid_brush_invalid.js';
import { issuesTestBrushBreak, issuesTestSolidModelAdd, issuesTestWorldCreate } from '../issues_test_world.js';

/**
 * Unit tests for the invalid brush issue provider: valid brushes report
 * nothing, a broken brush reports one error pointing at its mesh.
 */
describe('IssueProviderSolidBrushInvalid', () => {
  it('reports nothing for valid brushes', () => {
    const testWorld = issuesTestWorldCreate();
    issuesTestSolidModelAdd(testWorld, 'Valid', true);
    expect(new IssueProviderSolidBrushInvalid().collect(testWorld.world)).toEqual([]);
  });

  it('reports a broken brush as an error on its mesh with the validator reasons', () => {
    const testWorld = issuesTestWorldCreate();
    const { brush } = issuesTestSolidModelAdd(testWorld, 'Broken', true);
    if (!brush) {
      throw new Error('model has no brush');
    }
    issuesTestBrushBreak(brush);
    const provider = new IssueProviderSolidBrushInvalid();
    const issues = provider.collect(testWorld.world);
    expect(issues.length).toBe(1);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.objectUuid).toBe(brush.mesh?.uuid);
    expect(issues[0]?.objectName).toBe(brush.name);
    expect(issues[0]?.description).toContain('share a position');
    expect(issues[0]?.providerId).toBe(provider.id);
  });

  it('gives the same issue the same id on every run', () => {
    const testWorld = issuesTestWorldCreate();
    const { brush } = issuesTestSolidModelAdd(testWorld, 'Broken', true);
    if (!brush) {
      throw new Error('model has no brush');
    }
    issuesTestBrushBreak(brush);
    const provider = new IssueProviderSolidBrushInvalid();
    expect(provider.collect(testWorld.world)[0]?.id).toBe(provider.collect(testWorld.world)[0]?.id);
  });
});
