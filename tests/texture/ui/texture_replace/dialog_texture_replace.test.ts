import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DialogTextureReplace,
  type DialogTextureReplaceHandlers,
  type DialogTextureReplaceMaterial,
} from '@/texture/ui/texture_replace/dialog_texture_replace.js';
import { TextureReplaceRunner } from '@/texture/replace/texture_replace_runner.js';
import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';

/** Dialogs built by the running test. */
const textureReplaceTestDialogs: DialogTextureReplace[] = [];

/** Dialog, its host and spy handlers a test works with. */
interface TextureReplaceTestRig {
  readonly dialog: DialogTextureReplace;
  readonly host: HTMLElement;
  readonly handlers: DialogTextureReplaceHandlers;
  readonly materials: DialogTextureReplaceMaterial[];
}

/**
 * Builds a replacement dialog over generated library materials.
 *
 * @param selectionHasObjects Whether the stand-in selection holds objects.
 * @param repaintedFaceCount Face count the spy replacement reports.
 * @returns Test rig.
 */
function textureReplaceTestRigCreate(selectionHasObjects: boolean, repaintedFaceCount: number): TextureReplaceTestRig {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const materials = ['stone', 'wood'].map((name) => ({ id: `test/${name}`, displayName: `Test ${name}` }));
  const handlers: DialogTextureReplaceHandlers = {
    materialsList: () => materials,
    scopeDefaultRead: () => (selectionHasObjects ? 'selection' : 'all'),
    replace: vi.fn(() => ({
      faceCount: repaintedFaceCount,
      message: TextureReplaceRunner.messageFormat(repaintedFaceCount),
    })),
  };
  const dialog = new DialogTextureReplace(host, handlers);
  textureReplaceTestDialogs.push(dialog);
  return { dialog, host, handlers, materials };
}

/**
 * Finds a list of the dialog by class name.
 *
 * @param host Host of the dialog.
 * @param className Class name of the list.
 * @returns The list, or null when missing.
 */
function textureReplaceTestSelectFind(host: HTMLElement, className: string): HTMLSelectElement | null {
  return host.querySelector<HTMLSelectElement>(`.${className}`);
}

afterEach(() => {
  textureReplaceTestDialogs.splice(0).forEach((dialog) => dialog.dispose());
  document.body.replaceChildren();
});

describe('DialogTextureReplace', () => {
  it('opens with the given texture to find and the Hammer++ labels', () => {
    const { dialog, host, materials } = textureReplaceTestRigCreate(true, 0);
    const findId = materials[1]?.id ?? '';
    dialog.openFor(findId);
    expect(dialog.isOpen()).toBe(true);
    expect(textureReplaceTestSelectFind(host, 'dialog-texture-replace-find')?.value).toBe(findId);
    const text = host.textContent ?? '';
    ['Find:', 'Replace:', 'In:'].forEach((label) => expect(text).toContain(label));
  });

  it('offers a texture missing from the library', () => {
    const { dialog, host } = textureReplaceTestRigCreate(true, 0);
    const missingId = `test/missing_${Math.random().toString(36).slice(2)}`;
    dialog.openFor(missingId);
    expect(textureReplaceTestSelectFind(host, 'dialog-texture-replace-find')?.value).toBe(missingId);
  });

  it('searches the selection when objects are selected and everything otherwise', () => {
    const withSelection = textureReplaceTestRigCreate(true, 0);
    withSelection.dialog.openFor(withSelection.materials[0]?.id ?? '');
    expect(textureReplaceTestSelectFind(withSelection.host, 'dialog-texture-replace-scope')?.value).toBe('selection');
    const withoutSelection = textureReplaceTestRigCreate(false, 0);
    withoutSelection.dialog.openFor(withoutSelection.materials[0]?.id ?? '');
    expect(textureReplaceTestSelectFind(withoutSelection.host, 'dialog-texture-replace-scope')?.value).toBe('all');
  });

  it('runs the replacement with the chosen materials and reports the face count', () => {
    const repaintedFaceCount = 3;
    const { dialog, host, handlers, materials } = textureReplaceTestRigCreate(false, repaintedFaceCount);
    const findId = materials[0]?.id ?? '';
    const replaceId = materials[1]?.id ?? '';
    dialog.openFor(findId);
    const replaceSelect = textureReplaceTestSelectFind(host, 'dialog-texture-replace-with');
    if (replaceSelect) {
      replaceSelect.value = replaceId;
    }
    host.querySelector<HTMLElement>('.dialog-texture-replace-run')?.click();
    expect(handlers.replace).toHaveBeenCalledWith(findId, replaceId, 'all');
    expect(host.querySelector('.dialog-texture-replace-result')?.textContent ?? '').toContain(
      String(repaintedFaceCount),
    );
  });

  it('is a floating content host whose body holds the rows and closes on Escape', () => {
    const { dialog, host, materials } = textureReplaceTestRigCreate(false, 0);
    expect(dialog).toBeInstanceOf(PanelFloatingContentHost);
    expect(dialog.bodyRead().querySelector('.dialog-texture-replace-find')).not.toBeNull();
    dialog.openFor(materials[0]?.id ?? '');
    expect(host.querySelector('.dialog-texture-replace')?.textContent ?? '').toContain('Replace Textures');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.isOpen()).toBe(false);
  });
});
