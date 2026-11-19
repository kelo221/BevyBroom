import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/**
 * Proves the layout hears about every component selection change, so the gizmo
 * can follow it at once.
 */
describe('CoordinatorEditMode component selection change', () => {
  it('reports selecting and clearing components', () => {
    const model = new SolidModel('SelectionChange');
    model.addBoxBrush(1, SolidOperation.Additive);
    const onComponentSelectionChanged = vi.fn();
    const coordinator = new CoordinatorEditMode({
      getPrimaryScene: () => new THREE.Scene(),
      getSelectedObjects: () => [model.root],
      getViewports: () => [],
      showStatusMessage: vi.fn(),
      getCommandStack: () => null,
      onComponentSelectionChanged,
    });
    expect(coordinator.enterFromObjectSelection()).toBe(true);
    const targetId = coordinator.getSession().getDomain()[0]?.targetId ?? '';
    const selection = coordinator.getSession().getComponentSelection();
    onComponentSelectionChanged.mockClear();
    selection.select({ targetId, kind: 'vertex', componentKey: '0' }, false);
    expect(onComponentSelectionChanged).toHaveBeenCalled();
    onComponentSelectionChanged.mockClear();
    selection.clear();
    expect(onComponentSelectionChanged).toHaveBeenCalled();
  });
});
