import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FaceInspector } from '@/texture/ui/face_inspector/face_inspector.js';
import { FaceAttributesEditor } from '@/texture/ui/face_attributes/face_attributes_editor.js';
import { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';

/**
 * Proves the face inspector stacks the attributes over a flexible material
 * browser and only refreshes from the selection while visible.
 */
describe('FaceInspector', () => {
  let host: HTMLElement;
  let refreshFromSelection: ReturnType<typeof vi.fn<() => void>>;
  let faceAttributesEditor: FaceAttributesEditor;
  let materialBrowser: MaterialBrowser;
  let inspector: FaceInspector;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    refreshFromSelection = vi.fn<() => void>();
    faceAttributesEditor = new FaceAttributesEditor(
      { onAlign: vi.fn(), onApplyPartialTrs: vi.fn(), onRelativeOp: vi.fn(), onReset: vi.fn() },
      () => null,
    );
    materialBrowser = new MaterialBrowser({ onOpenFolder: vi.fn(), onSelectTexture: vi.fn() });
    inspector = new FaceInspector({ faceAttributesEditor, materialBrowser, selectionSource: { refreshFromSelection } });
    host.appendChild(inspector.getElement());
  });

  afterEach(() => {
    inspector.dispose();
    host.remove();
  });

  it('stacks the attributes at natural height above the flexible material browser', () => {
    const column = inspector.getElement();
    expect(column.style.flexDirection).toBe('column');
    expect(Array.from(column.children)).toEqual([faceAttributesEditor.getElement(), materialBrowser.getElement()]);
    expect(faceAttributesEditor.getElement().style.flex).toBe('0 0 auto');
    expect(materialBrowser.getElement().style.flex).toBe('1 1 auto');
    expect(inspector.getFaceAttributesEditor()).toBe(faceAttributesEditor);
    expect(inspector.getMaterialBrowser()).toBe(materialBrowser);
  });

  it('refreshes from the selection while visible', () => {
    expect(inspector.isVisible()).toBe(true);
    inspector.refreshFromSelection();
    expect(refreshFromSelection).toHaveBeenCalledTimes(1);
  });

  it('skips selection refreshes while hidden and refreshes once when shown again', () => {
    inspector.setVisible(false);
    expect(inspector.isVisible()).toBe(false);
    expect(inspector.getElement().style.display).toBe('none');
    inspector.refreshFromSelection();
    inspector.refreshFromSelection();
    expect(refreshFromSelection).not.toHaveBeenCalled();
    inspector.setVisible(true);
    expect(inspector.getElement().style.display).toBe('flex');
    expect(refreshFromSelection).toHaveBeenCalledTimes(1);
  });

  it('detaches its column on dispose', () => {
    inspector.dispose();
    expect(host.contains(inspector.getElement())).toBe(false);
  });
});
