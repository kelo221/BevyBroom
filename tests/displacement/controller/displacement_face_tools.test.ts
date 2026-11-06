import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import {
  DisplacementFaceTools,
  type DisplacementFaceSelectionSource,
} from '@/displacement/controller/displacement_face_tools.js';
import {
  displacementActionsSharedChangeListenerAdd,
  displacementActionsSharedRead,
} from '@/displacement/controller/displacement_actions_shared.js';

/** Stand-in face selection that records its listeners. */
class DisplacementFaceToolsTestSelection implements DisplacementFaceSelectionSource {
  readonly listeners = new Set<(faces: FaceSelection[]) => void>();

  /**
   * Returns the empty selection.
   *
   * @returns No faces.
   */
  getSelectedFaces(): FaceSelection[] {
    return [];
  }

  /**
   * Ignores seed selections.
   *
   * @param _seeds Ignored seeds.
   * @param _addToSelection Ignored mode.
   */
  selectFaceSeeds(_seeds: FaceSelection[], _addToSelection: boolean): void {}

  /**
   * Records a listener.
   *
   * @param listener Selection listener.
   * @returns Function removing the listener.
   */
  faceSelectionListenerAdd(listener: (faces: FaceSelection[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * Creates face tools over a stand-in selection.
 *
 * @param selection Face selection the tools watch.
 * @param commandStack Undo stack the tools watch.
 * @returns New face tools.
 */
function faceToolsTestCreate(
  selection: DisplacementFaceSelectionSource = new DisplacementFaceToolsTestSelection(),
  commandStack: CommandStack = new CommandStack(8),
): DisplacementFaceTools {
  return new DisplacementFaceTools({
    commandStack,
    faceSelection: selection,
    isCtrlDown: () => false,
    isShiftDown: () => false,
    afterDab: () => undefined,
  });
}

/** Lifetime of the displacement tools of one face selection. */
describe('DisplacementFaceTools', () => {
  it('installs its actions while alive and leaves newer tools installed when disposed', () => {
    const older = faceToolsTestCreate();
    const olderActions = displacementActionsSharedRead();
    expect(olderActions).not.toBeNull();
    const newer = faceToolsTestCreate();
    const newerActions = displacementActionsSharedRead();
    expect(newerActions).not.toBe(olderActions);
    older.dispose();
    older.dispose();
    expect(displacementActionsSharedRead()).toBe(newerActions);
    newer.dispose();
    expect(displacementActionsSharedRead()).toBeNull();
    expect(newer.sculptRouter.isStrokeActive()).toBe(false);
  });

  it('notifies the shared change listeners on selection and undo stack changes until disposed', () => {
    const selection = new DisplacementFaceToolsTestSelection();
    const commandStack = new CommandStack(8);
    const tools = faceToolsTestCreate(selection, commandStack);
    let notifyCount = 0;
    const listenerRemove = displacementActionsSharedChangeListenerAdd(() => {
      notifyCount += 1;
    });
    selection.listeners.forEach((listener) => listener([]));
    expect(notifyCount).toBe(1);
    commandStack.notifyChanged();
    expect(notifyCount).toBe(2);
    tools.dispose();
    const countAfterDispose = notifyCount;
    expect(selection.listeners.size).toBe(0);
    commandStack.notifyChanged();
    expect(notifyCount).toBe(countAfterDispose);
    listenerRemove();
  });
});
