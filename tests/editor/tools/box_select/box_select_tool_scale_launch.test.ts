import { describe, expect, it, vi } from 'vitest';
import { EditorWindow } from '@/editor/window/editor_window.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { ScaleTool } from '@/editor/tools/scale_tool.js';
import { editorTestServicesCreate } from '../../editor_test_services.js';

/**
 * Creates the object tool editor over a non-empty selection.
 *
 * @param overrides Service members the test replaces.
 * @returns Editor with the bounds tool active.
 */
function editorCreate(overrides: Partial<EditorServices>): EditorWindow {
  const editor = new EditorWindow();
  editor.setServices(editorTestServicesCreate({ getSelectedCount: () => 1, ...overrides }));
  editor.validateTools();
  editor.userSwitchToBoundsTool();
  return editor;
}

/**
 * Proves the S key of the object tools starts single-use scaling only for
 * selections that may be scaled and reports why it does nothing otherwise.
 */
describe('BoxSelectTool single-use scale launch', () => {
  it('starts the single-use scale tool when the selection may be scaled', () => {
    const editor = editorCreate({ isSelectionScaleAllowed: () => true });
    expect(editor.onKeyDown('KeyS', new KeyboardEvent('keydown', { code: 'KeyS' }))).toBe(true);
    expect(editor.activeTool).toBeInstanceOf(ScaleTool);
    expect(editor.activeTool?.isSingleUse).toBe(true);
  });

  it('keeps the object tool and reports it when the selection only moves and rotates', () => {
    const setStatusMessage = vi.fn();
    const editor = editorCreate({ isSelectionScaleAllowed: () => false, setStatusMessage });
    const toolBefore = editor.activeTool;
    expect(editor.onKeyDown('KeyS', new KeyboardEvent('keydown', { code: 'KeyS' }))).toBe(true);
    expect(editor.activeTool).toBe(toolBefore);
    expect(editor.activeTool?.isSingleUse).not.toBe(true);
    expect(setStatusMessage).toHaveBeenLastCalledWith(expect.stringContaining('only move and rotate'));
  });
});
