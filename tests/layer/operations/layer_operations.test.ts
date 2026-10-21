import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { LayerOperations } from '@/layer/operations/layer_operations.js';
import { LayerSelectionOperations } from '@/layer/operations/layer_selection_operations.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { layerIdStoredRead } from '@/layer/model/layer_membership.js';
import {
  type LayerTestWorld,
  layerTestBoxAddToLayer,
  layerTestLayerAdd,
  layerTestWorldCreate,
} from '../layer_test_world.js';

/** Operations, undo stack and refresh counter over a fresh world. */
interface LayerOperationsRig {
  testWorld: LayerTestWorld;
  stack: CommandStack;
  operations: LayerOperations;
  refreshCount: () => number;
}

/**
 * Builds layer operations over a fresh world that count editor refreshes.
 *
 * @returns Test rig.
 */
function layerOperationsRigCreate(): LayerOperationsRig {
  const testWorld = layerTestWorldCreate();
  const stack = new CommandStack(32);
  let refreshes = 0;
  const operations = new LayerOperations(testWorld.manager, stack, () => refreshes++);
  return { testWorld, stack, operations, refreshCount: () => refreshes };
}

/**
 * Unit tests for the layer operations shared by the panel and the AI tools:
 * edits go onto the undo stack as one step each, refresh the editor, and edits
 * without an effect push nothing.
 */
describe('LayerOperations', () => {
  it('pushes nothing and does not refresh for edits without an effect', () => {
    const rig = layerOperationsRigCreate();
    expect(rig.operations.layerRemove(rig.testWorld.manager.layerDefaultRead().id)).toBe(false);
    expect(rig.stack.getUndoCount()).toBe(0);
    expect(rig.refreshCount()).toBe(0);
  });

  it('sets several switches as one undo step', () => {
    const rig = layerOperationsRigCreate();
    const layer = rig.operations.layerCreate('Switches');
    const undoCountBefore = rig.stack.getUndoCount();
    rig.operations.layerFlagsSet(layer.id, { hidden: true, locked: true });
    expect(rig.stack.getUndoCount()).toBe(undoCountBefore + 1);
    rig.stack.undo();
    const restored = rig.testWorld.manager.layerFind(layer.id);
    expect(restored?.hidden).toBe(false);
    expect(restored?.locked).toBe(false);
  });

  it('isolates one layer and shows all layers again, each as one undo step', () => {
    const rig = layerOperationsRigCreate();
    const kept = rig.operations.layerCreate('Kept');
    const other = rig.operations.layerCreate('Other');
    rig.operations.layerIsolate(kept.id);
    const manager = rig.testWorld.manager;
    expect(manager.layersList().filter((definition) => definition.hidden).length).toBe(2);
    expect(manager.layerFind(kept.id)?.hidden).toBe(false);
    rig.operations.layersShowAll();
    expect(manager.layerFind(other.id)?.hidden).toBe(false);
    rig.stack.undo();
    expect(manager.layerFind(other.id)?.hidden).toBe(true);
  });

  it('changes the current layer without an undo step but with a refresh', () => {
    const rig = layerOperationsRigCreate();
    const layer = rig.operations.layerCreate('Current');
    const undoCountBefore = rig.stack.getUndoCount();
    const refreshesBefore = rig.refreshCount();
    expect(rig.operations.currentLayerSet(layer.id)).toBe(true);
    expect(rig.stack.getUndoCount()).toBe(undoCountBefore);
    expect(rig.refreshCount()).toBe(refreshesBefore + 1);
  });
});

/** Unit tests for the layer edits that work with the object selection. */
describe('LayerSelectionOperations', () => {
  it('moves the selection into a layer', () => {
    const rig = layerOperationsRigCreate();
    const selection = new ManagerSelection();
    const selectionOperations = new LayerSelectionOperations(rig.operations, selection);
    const target = rig.operations.layerCreate('Target');
    const box = layerTestBoxAddToLayer(rig.testWorld, rig.testWorld.manager.layerDefaultRead().id, 'box');
    selection.setSelection([box]);
    expect(selectionOperations.selectionMoveToLayer(target.id)).toEqual([box]);
    expect(layerIdStoredRead(box)).toBe(target.id);
  });

  it('selects every object of a shown, unlocked layer only', () => {
    const rig = layerOperationsRigCreate();
    const selection = new ManagerSelection();
    const selectionOperations = new LayerSelectionOperations(rig.operations, selection);
    const layer = layerTestLayerAdd(rig.testWorld.manager, 'Pick');
    const first = layerTestBoxAddToLayer(rig.testWorld, layer.id, 'first');
    const second = layerTestBoxAddToLayer(rig.testWorld, layer.id, 'second');
    layerTestBoxAddToLayer(rig.testWorld, rig.testWorld.manager.layerDefaultRead().id, 'other');
    expect(selectionOperations.layerObjectsSelect(layer.id)).toBe(true);
    expect(new Set(selection.getAllSelectedObjectsAsArray())).toEqual(new Set([first, second]));
    selection.clearSelection();
    rig.testWorld.manager.layerFlagSet(layer.id, 'locked', true);
    expect(selectionOperations.layerObjectsSelect(layer.id)).toBe(false);
    expect(selection.getSelectedObjectCount()).toBe(0);
  });
});
