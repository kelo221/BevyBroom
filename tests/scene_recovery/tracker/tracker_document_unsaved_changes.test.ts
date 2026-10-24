import { describe, expect, it, vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { TrackerDocumentUnsavedChanges } from '@/scene_recovery/tracker/tracker_document_unsaved_changes.js';
import { sceneRecoveryTestCommandCreate } from '../scene_recovery_test_support.js';

/**
 * The unsaved changes tracker compares the history with the saved point: edits
 * make the document unsaved, undoing back to the saved point makes it saved,
 * and a forgotten saved point stays unsaved until the next save.
 */
describe('TrackerDocumentUnsavedChanges', () => {
  it('starts saved and becomes unsaved after an edit', () => {
    const stack = new CommandStack(16);
    const tracker = new TrackerDocumentUnsavedChanges(stack);
    expect(tracker.hasUnsavedChanges()).toBe(false);
    stack.push(sceneRecoveryTestCommandCreate());
    expect(tracker.hasUnsavedChanges()).toBe(true);
    tracker.dispose();
  });

  it('is saved again after undoing back to the saved point, and unsaved after redo', () => {
    const stack = new CommandStack(16);
    stack.push(sceneRecoveryTestCommandCreate());
    const tracker = new TrackerDocumentUnsavedChanges(stack);
    stack.push(sceneRecoveryTestCommandCreate());
    stack.undo();
    expect(tracker.hasUnsavedChanges()).toBe(false);
    stack.redo();
    expect(tracker.hasUnsavedChanges()).toBe(true);
    tracker.savedPointMark();
    expect(tracker.hasUnsavedChanges()).toBe(false);
    tracker.dispose();
  });

  it('stays unsaved after the saved point is forgotten, whatever is undone', () => {
    const stack = new CommandStack(16);
    const tracker = new TrackerDocumentUnsavedChanges(stack);
    tracker.savedPointForget();
    stack.push(sceneRecoveryTestCommandCreate());
    stack.undo();
    expect(tracker.hasUnsavedChanges()).toBe(true);
    tracker.dispose();
  });

  it('reports only switches between saved and unsaved', () => {
    const stack = new CommandStack(16);
    const tracker = new TrackerDocumentUnsavedChanges(stack);
    const reported: boolean[] = [];
    tracker.onUnsavedChangesChanged((isUnsaved) => reported.push(isUnsaved));
    stack.push(sceneRecoveryTestCommandCreate());
    stack.push(sceneRecoveryTestCommandCreate());
    tracker.savedPointMark();
    expect(reported).toEqual([true, false]);
    tracker.dispose();
    const afterDispose = vi.fn();
    tracker.onUnsavedChangesChanged(afterDispose);
    stack.push(sceneRecoveryTestCommandCreate());
    expect(afterDispose).not.toHaveBeenCalled();
  });
});
