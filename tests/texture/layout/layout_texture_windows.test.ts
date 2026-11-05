import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutTextureWindows } from '@/texture/layout/layout_texture_windows.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  faceInspectorTestPartsCreate,
  faceInspectorTestPartsDispose,
  type FaceInspectorTestParts,
} from './layout_face_inspector_test_support.js';

describe('LayoutTextureWindows', () => {
  let testParts: FaceInspectorTestParts;
  let host: HTMLElement;
  let textureWindows: LayoutTextureWindows;

  beforeEach(() => {
    testParts = faceInspectorTestPartsCreate();
    host = document.createElement('div');
    document.body.appendChild(host);
    textureWindows = new LayoutTextureWindows({
      host,
      faceInspectorParts: testParts.parts,
      commandStack: testParts.commandStack,
      worldObject: testParts.world,
      selectionManager: testParts.selectionManager,
      statusBar: null,
      afterSurfaceChange: () => testParts.afterSurfaceChange(),
    });
  });

  afterEach(() => {
    textureWindows.dispose();
    faceInspectorTestPartsDispose(testParts);
    document.body.replaceChildren();
  });

  it('keeps the face inspector inactive while no texture window is open', () => {
    expect(textureWindows.textureBrowser.isOpen()).toBe(false);
    expect(getStateFaceEditSession().sheetOpenRead()).toBe(false);
    expect(testParts.parts.faceInspector.isVisible()).toBe(false);
  });

  it('activates the face inspector while the texture browser is open', () => {
    textureWindows.textureBrowserShow();
    expect(textureWindows.textureBrowser.isOpen()).toBe(true);
    expect(testParts.parts.faceInspector.isVisible()).toBe(true);
    textureWindows.textureBrowser.hide();
    expect(testParts.parts.faceInspector.isVisible()).toBe(false);
  });

  it('opens the Face Edit Sheet and activates the face inspector while it is open', () => {
    textureWindows.faceEditSheetReveal();
    expect(getStateFaceEditSession().sheetOpenRead()).toBe(true);
    expect(textureWindows.faceEditSheet.isOpen()).toBe(true);
    expect(testParts.parts.faceInspector.isVisible()).toBe(true);
    getStateFaceEditSession().sheetOpenWrite(false);
    expect(testParts.parts.faceInspector.isVisible()).toBe(false);
  });

  it('lists the library in the Face Edit Sheet texture list and applies through the browser', () => {
    const selectTextureSpy = vi.spyOn(testParts.parts.textureBrowserController, 'selectTexture');
    textureWindows.faceEditSheetReveal();
    const libraryIds = testParts.parts.textureBrowserController
      .getLibrary()
      .getEntries()
      .map((entry) => entry.id);
    const select = host.querySelector<HTMLSelectElement>('select.face-edit-sheet-texture-select');
    const listedIds = Array.from(select?.options ?? []).map((option) => option.value);
    libraryIds.forEach((id) => expect(listedIds).toContain(id));
    host.querySelector<HTMLButtonElement>('button.face-edit-sheet-texture-apply')?.click();
    expect(selectTextureSpy).toHaveBeenCalledWith(getStateTexturePaint().getLastTextureId());
    getStateFaceEditSession().sheetOpenWrite(false);
  });

  it('opens the Replace Textures window with the texture to find', () => {
    const textureId = `test/replace_${Math.random().toString(36).slice(2)}`;
    textureWindows.textureReplaceOpen(textureId);
    expect(textureWindows.textureReplaceDialog.isOpen()).toBe(true);
    expect(host.querySelector<HTMLSelectElement>('.dialog-texture-replace-find')?.value).toBe(textureId);
  });
});
