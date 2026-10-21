import { describe, expect, it } from 'vitest';
import { IssueProviderSolidModelWarnings } from '@/info_panel/issues/providers/issue_provider_solid_model_warnings.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { issuesTestSolidModelAdd, issuesTestWorldCreate } from '../issues_test_world.js';

/**
 * Unit tests for the solid model warning issue provider: empty models, inverted
 * worlds and subtractive brushes that cut nothing.
 */
describe('IssueProviderSolidModelWarnings', () => {
  it('reports nothing for a model with one additive brush', () => {
    const testWorld = issuesTestWorldCreate();
    issuesTestSolidModelAdd(testWorld, 'Plain', true);
    expect(new IssueProviderSolidModelWarnings().collect(testWorld.world)).toEqual([]);
  });

  it('reports an empty model as a warning on the model root', () => {
    const testWorld = issuesTestWorldCreate();
    const { model } = issuesTestSolidModelAdd(testWorld, 'Empty', false);
    const issues = new IssueProviderSolidModelWarnings().collect(testWorld.world);
    expect(issues.length).toBe(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectUuid).toBe(model.root.uuid);
    expect(issues[0]?.description).toBe('Solid model has no brushes');
  });

  it('reports a model with an inverted world', () => {
    const testWorld = issuesTestWorldCreate();
    const { model } = issuesTestSolidModelAdd(testWorld, 'Inverted', true);
    model.setInvertedWorld(true);
    const issues = new IssueProviderSolidModelWarnings().collect(testWorld.world);
    expect(
      issues.some((issue) => issue.objectUuid === model.root.uuid && issue.description.includes('invertedWorld')),
    ).toBe(true);
  });

  it('reports a subtractive brush far from every additive brush on the brush only', () => {
    const testWorld = issuesTestWorldCreate();
    const { model, brush: additive } = issuesTestSolidModelAdd(testWorld, 'Cuts', true);
    const farCutter = model.addBoxBrush(1, SolidOperation.Subtractive);
    farCutter.position.set(50 + Math.random() * 10, 0, 0);
    farCutter.pushTransformToMesh();
    const nearCutter = model.addBoxBrush(1, SolidOperation.Subtractive);
    nearCutter.position.copy(additive?.position ?? nearCutter.position);
    nearCutter.pushTransformToMesh();
    const issues = new IssueProviderSolidModelWarnings().collect(testWorld.world);
    expect(issues.map((issue) => issue.objectUuid)).toEqual([farCutter.mesh?.uuid]);
    expect(issues[0]?.objectName).toBe(farCutter.name);
  });
});
