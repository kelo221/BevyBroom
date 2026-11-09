import { describe, it, expect, vi } from 'vitest';
import { Widget } from '@/editor/widgets/widget.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { editorTestServicesCreate } from '../editor_test_services.js';

/** Plain widget used to exercise the base class. */
class WidgetPlain extends Widget {}

describe('Widget pointerPressHoldRelease', () => {
  it('cancels the transform drag and clears the latch of every widget', () => {
    const cancelActiveTransformDrag = vi.fn<EditorServices['cancelActiveTransformDrag']>();
    const editor = new EditorWindow();
    editor.setServices(editorTestServicesCreate({ cancelActiveTransformDrag }));
    const pressed = new WidgetPlain();
    const sibling = new WidgetPlain();
    editor.addWidget(pressed);
    editor.addWidget(sibling);
    pressed.latchWantsActiveFromGizmoState(true);
    sibling.latchWantsActiveFromGizmoState(true);
    expect(pressed.pointerPressHoldRelease()).toBe(true);
    expect(cancelActiveTransformDrag).toHaveBeenCalledTimes(1);
    expect(pressed.wantsActive).toBe(false);
    expect(sibling.wantsActive).toBe(false);
  });

  it('reports nothing to release without a latched press', () => {
    const widget = new WidgetPlain();
    expect(widget.pointerPressHoldRelease()).toBe(false);
  });
});
