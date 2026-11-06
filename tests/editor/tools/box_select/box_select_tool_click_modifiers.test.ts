import { describe, expect, it, vi } from 'vitest';
import { EditorWindow } from '@/editor/window/editor_window.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { BoxSelectTool } from '@/editor/tools/box_select_tool.js';
import { editorTestServicesCreate } from '../../editor_test_services.js';

/** Modifier keys held during one test click. */
interface ClickModifiersTestKeys {
  shift: boolean;
  ctrl: boolean;
}

/** Spies a test click reports to. */
interface ClickModifiersTestSpies {
  objectClick: ReturnType<typeof vi.fn<EditorServices['applyObjectClickSelectionAtClientPoint']>>;
  faceEdit: ReturnType<typeof vi.fn<(clientX: number, clientY: number) => boolean>>;
}

/**
 * Creates spies for the object click selection and the Shift+click face edit.
 *
 * @param isFaceEditTaken Value the face edit spy returns.
 * @returns Spies.
 */
function clickModifiersTestSpiesCreate(isFaceEditTaken: boolean): ClickModifiersTestSpies {
  return {
    objectClick: vi.fn<EditorServices['applyObjectClickSelectionAtClientPoint']>(),
    faceEdit: vi.fn<(clientX: number, clientY: number) => boolean>(() => isFaceEditTaken),
  };
}

/**
 * Clicks with the box select tool at a pointer position while modifier keys are
 * held.
 *
 * @param spies Spies the editor services report to.
 * @param keys Modifier keys held during the click.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 */
function clickModifiersTestClick(
  spies: ClickModifiersTestSpies,
  keys: ClickModifiersTestKeys,
  clientX: number,
  clientY: number,
): void {
  const editor = new EditorWindow();
  editor.setServices(
    editorTestServicesCreate({
      applyObjectClickSelectionAtClientPoint: spies.objectClick,
      objectShiftClickFaceEditApply: spies.faceEdit,
      isShiftPressed: () => keys.shift,
      isCtrlPressed: () => keys.ctrl,
      isModifierPressed: () => keys.shift || keys.ctrl,
    }),
  );
  editor.validateTools();
  const tool = new BoxSelectTool();
  tool.editor = editor;
  editor.lastPointerClientX = clientX;
  editor.lastPointerClientY = clientY;
  tool.onMouseDown(0);
  tool.onGlobalMouseUp(0);
}

/**
 * Proves the object tool click modifiers: a plain click replaces the selection,
 * Ctrl+click toggles objects, Shift+click offers the click to face editing
 * first and falls back to adding the object when face editing does not take
 * it.
 */
describe('BoxSelectTool click modifiers', () => {
  it('replaces the selection on a plain click without offering it to face editing', () => {
    const spies = clickModifiersTestSpiesCreate(true);
    clickModifiersTestClick(spies, { shift: false, ctrl: false }, 31, 47);
    expect(spies.faceEdit).not.toHaveBeenCalled();
    expect(spies.objectClick).toHaveBeenCalledExactlyOnceWith(31, 47, false, false);
  });

  it('toggles the object on Ctrl+click without offering it to face editing', () => {
    const spies = clickModifiersTestSpiesCreate(true);
    clickModifiersTestClick(spies, { shift: false, ctrl: true }, 12, 64);
    expect(spies.faceEdit).not.toHaveBeenCalled();
    expect(spies.objectClick).toHaveBeenCalledExactlyOnceWith(12, 64, false, true);
  });

  it('lets face editing take a Shift+click on a brush face and skips object selection', () => {
    const spies = clickModifiersTestSpiesCreate(true);
    clickModifiersTestClick(spies, { shift: true, ctrl: false }, 70, 22);
    expect(spies.faceEdit).toHaveBeenCalledExactlyOnceWith(70, 22);
    expect(spies.objectClick).not.toHaveBeenCalled();
  });

  it('adds the object on a Shift+click that face editing leaves alone', () => {
    const spies = clickModifiersTestSpiesCreate(false);
    clickModifiersTestClick(spies, { shift: true, ctrl: false }, 55, 9);
    expect(spies.faceEdit).toHaveBeenCalledExactlyOnceWith(55, 9);
    expect(spies.objectClick).toHaveBeenCalledExactlyOnceWith(55, 9, true, false);
  });

  it('keeps Shift+Ctrl+click an object toggle without offering it to face editing', () => {
    const spies = clickModifiersTestSpiesCreate(true);
    clickModifiersTestClick(spies, { shift: true, ctrl: true }, 18, 81);
    expect(spies.faceEdit).not.toHaveBeenCalled();
    expect(spies.objectClick).toHaveBeenCalledExactlyOnceWith(18, 81, true, true);
  });
});
