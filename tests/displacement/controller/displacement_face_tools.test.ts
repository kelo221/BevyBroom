import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { DisplacementFaceTools } from '@/displacement/controller/displacement_face_tools.js';
import { displacementActionsSharedRead } from '@/displacement/controller/displacement_actions_shared.js';

/**
 * Creates face tools over an empty selection.
 *
 * @returns New face tools.
 */
function faceToolsTestCreate(): DisplacementFaceTools {
  return new DisplacementFaceTools({
    commandStack: new CommandStack(8),
    selectedFacesRead: () => [],
    isCtrlDown: () => false,
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
});
