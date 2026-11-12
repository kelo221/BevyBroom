import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierStackOperationIssue } from '@/modifier/stack/evaluate/modifier_stack_operation_issue.js';
import type { ModifierStackStatus } from '@/modifier/stack/evaluate/modifier_stack_status.js';
import type { ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';

/**
 * Creates feedback with the given capture count and nothing else.
 *
 * @param captured Captured brush count.
 * @returns Status.
 */
function issueStatus(captured: number): ModifierStackStatus {
  return { captured, derived: 0, skipped: 0, unbevelled: 0, steps: [] };
}

/**
 * Creates a volume with an operation and optional per-axis scale.
 *
 * @param operation Volume operation.
 * @param scale Volume scale.
 * @returns Volume and its settings.
 */
function issueVolume(operation: ModifierStackVolumeOperation, scale = new THREE.Vector3(1, 1, 1)) {
  const volume = ModifierVolume.create({ operation, modifiers: [] });
  volume.scale.copy(scale);
  volume.updateMatrixWorld(true);
  return { volume, settings: ModifierVolume.read(volume) };
}

describe('modifier stack operation issue', () => {
  it('says nothing for a volume without an operation, even when it is flat and captures nothing', () => {
    const { volume, settings } = issueVolume('none', new THREE.Vector3(1, 0, 1));
    expect(modifierStackOperationIssue(volume, settings, issueStatus(0))).toBe('');
  });

  it('says nothing for a boolean volume with thickness that captured brushes', () => {
    const { volume, settings } = issueVolume('intersect');
    expect(modifierStackOperationIssue(volume, settings, issueStatus(1))).toBe('');
  });

  it('names each flat axis of a boolean volume and the operation it skips', () => {
    const axes = ['X', 'Y', 'Z'] as const;
    axes.forEach((axis, index) => {
      const scale = new THREE.Vector3(1, 1, 1).setComponent(index, 0);
      const { volume, settings } = issueVolume('subtract', scale);
      expect(modifierStackOperationIssue(volume, settings, issueStatus(2))).toBe(
        `the volume has no thickness on its ${axis} axis, so the Subtractive box is not written`,
      );
    });
  });

  it('reports a boolean volume that captured no brushes', () => {
    const { volume, settings } = issueVolume('add');
    expect(modifierStackOperationIssue(volume, settings, issueStatus(0))).toBe(
      'the volume captures no brushes, so the Additive box is not written',
    );
  });

  it('waits for an evaluation before reporting missing captures', () => {
    const { volume, settings } = issueVolume('add');
    expect(modifierStackOperationIssue(volume, settings, null)).toBe('');
  });
});
