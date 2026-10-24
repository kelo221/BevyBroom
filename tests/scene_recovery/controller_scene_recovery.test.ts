import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { ControllerSceneRecovery } from '@/scene_recovery/controller_scene_recovery.js';
import { TrackerDocumentUnsavedChanges } from '@/scene_recovery/tracker/tracker_document_unsaved_changes.js';
import { SceneRecoveryStoreMemory, sceneRecoveryTestCommandCreate } from './scene_recovery_test_support.js';

const AUTOSAVE_DELAY_MILLISECONDS = 1000;

/**
 * Builds a controller over a fresh history, an in-memory store and a scene text
 * that changes with every edit.
 *
 * @returns Controller with its history, tracker, store and failure reports.
 */
function recoveryRigCreate() {
  const commandStack = new CommandStack(16);
  const tracker = new TrackerDocumentUnsavedChanges(commandStack);
  const store = new SceneRecoveryStoreMemory();
  const failures: string[] = [];
  const controller = new ControllerSceneRecovery({
    commandStack,
    tracker,
    store,
    sceneJsonBuild: () => JSON.stringify({ edits: commandStack.getUndoCount() }),
    documentFileNameRead: () => 'hall.json',
    autosaveFailureReport: (message) => failures.push(message),
    autosaveDelayMilliseconds: AUTOSAVE_DELAY_MILLISECONDS,
    clockRead: () => Date.now(),
  });
  return { commandStack, tracker, store, failures, controller };
}

/**
 * The recovery controller autosaves unsaved work after a delay, forgets the
 * snapshot once the work is saved, keeps restored work protected, and reports a
 * store that refuses writes once.
 */
describe('ControllerSceneRecovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('autosaves once after a burst of edits, with the latest scene', () => {
    const rig = recoveryRigCreate();
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    expect(rig.controller.isAutosavePending()).toBe(true);
    expect(rig.store.snapshot).toBeNull();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    expect(rig.store.writeCount).toBe(1);
    expect(JSON.parse(rig.store.snapshot?.sceneJson ?? '{}')).toEqual({ edits: rig.commandStack.getUndoCount() });
    expect(rig.store.snapshot?.documentFileName).toBe('hall.json');
    rig.controller.dispose();
  });

  it('removes the snapshot when the document is saved or undone back to its saved state', () => {
    const rig = recoveryRigCreate();
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    rig.controller.savedStateAdopt();
    expect(rig.store.snapshot).toBeNull();
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    expect(rig.store.snapshot).not.toBeNull();
    rig.commandStack.undo();
    expect(rig.store.snapshot).toBeNull();
    expect(rig.controller.isAutosavePending()).toBe(false);
    rig.controller.dispose();
  });

  it('writes a pending autosave right away when flushed', () => {
    const rig = recoveryRigCreate();
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    rig.controller.autosaveFlush();
    expect(rig.store.writeCount).toBe(1);
    expect(rig.controller.isAutosavePending()).toBe(false);
    rig.controller.dispose();
  });

  it('keeps restored work protected even after its history is cleared', () => {
    const rig = recoveryRigCreate();
    rig.commandStack.clear();
    rig.controller.restoredStateAdopt();
    expect(rig.tracker.hasUnsavedChanges()).toBe(true);
    expect(rig.store.snapshot).not.toBeNull();
    rig.controller.dispose();
  });

  it('reports a refused autosave once until autosaving works again', () => {
    const rig = recoveryRigCreate();
    rig.store.refusalMessage = 'storage is full';
    for (let edit = 0; edit < 3; edit += 1) {
      rig.commandStack.push(sceneRecoveryTestCommandCreate());
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    }
    expect(rig.failures).toHaveLength(1);
    expect(rig.failures[0]).toContain('storage is full');
    rig.store.refusalMessage = null;
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    expect(rig.store.snapshot).not.toBeNull();
    rig.controller.dispose();
  });

  it('stops autosaving once disposed', () => {
    const rig = recoveryRigCreate();
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    rig.controller.dispose();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MILLISECONDS);
    expect(rig.store.writeCount).toBe(0);
  });
});
