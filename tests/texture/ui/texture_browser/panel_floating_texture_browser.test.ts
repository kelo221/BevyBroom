import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelFloatingTextureBrowser } from '@/texture/ui/texture_browser/panel_floating_texture_browser.js';
import {
  elementHiddenByDisplayIs,
  faceInspectorTestPartsCreate,
  faceInspectorTestPartsDispose,
  type FaceInspectorTestParts,
} from '../../layout/layout_face_inspector_test_support.js';

describe('PanelFloatingTextureBrowser', () => {
  let testParts: FaceInspectorTestParts;
  let host: HTMLElement;
  let textureBrowser: PanelFloatingTextureBrowser;

  beforeEach(() => {
    testParts = faceInspectorTestPartsCreate();
    host = document.createElement('div');
    document.body.appendChild(host);
    textureBrowser = new PanelFloatingTextureBrowser(host, testParts.parts.faceInspector);
  });

  afterEach(() => {
    textureBrowser.dispose();
    faceInspectorTestPartsDispose(testParts);
    document.body.replaceChildren();
  });

  it('hosts the face inspector and shows it under the host while open', () => {
    const faceInspectorElement = testParts.parts.faceInspector.getElement();
    expect(textureBrowser.faceInspectorRead()).toBe(testParts.parts.faceInspector);
    expect(textureBrowser.bodyRead().contains(faceInspectorElement)).toBe(true);
    expect(host.contains(faceInspectorElement)).toBe(false);
    textureBrowser.show();
    expect(host.contains(faceInspectorElement)).toBe(true);
    expect(host.querySelector('.panel-floating-texture-browser')?.textContent ?? '').toContain('Texture Browser');
  });

  it('hides the UV fields the Face Edit Sheet shows', () => {
    textureBrowser.show();
    const scaleField = textureBrowser.bodyRead().querySelector('input[aria-label="X Scale"]');
    expect(scaleField).not.toBeNull();
    if (scaleField) {
      expect(elementHiddenByDisplayIs(scaleField, textureBrowser.bodyRead())).toBe(true);
    }
  });
});
