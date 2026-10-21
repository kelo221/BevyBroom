import { describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { documentIdentityRead } from '@/io/document/document_identity.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';

/** Scene document payload of get_scene_document. */
interface SceneDocumentData {
  documentId: string;
  json: string;
}

/**
 * Builds an EditorApi whose load hook opens scene text the way the editor's
 * Load does.
 *
 * @returns The host parts and the API.
 */
function sceneDocumentRigCreate(): EditorApiTestHostParts & { api: EditorApi } {
  const sceneIO = new HandlerSceneIo();
  const parts = editorApiTestHostCreate();
  parts.host.sceneDocumentLoad = (json) => sceneIO.loadSceneFromText(json, parts.world, () => undefined, null);
  return { ...parts, api: new EditorApi(parts.host) };
}

/**
 * Reads the open scene through get_scene_document.
 *
 * @param api Editor API.
 * @returns Document id and scene text.
 */
function sceneDocumentRead(api: EditorApi): SceneDocumentData {
  const result = api.invokeTool('get_scene_document');
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.data as SceneDocumentData;
}

/** Unit tests for the get_scene_document and load_scene_document MCP tools. */
describe('EditorApiSceneDocument', () => {
  it('returns the scene file text with the document id of the open scene', () => {
    const rig = sceneDocumentRigCreate();
    rig.api.invokeTool('add_portal', { name: 'Door' });
    const document = sceneDocumentRead(rig.api);
    const scene = JSON.parse(document.json) as SceneJSON;
    expect(document.documentId).toBe(documentIdentityRead(rig.world));
    expect(scene.documentId).toBe(document.documentId);
    expect(scene.objects.some((entry) => entry.type === 'portal' && entry.name === 'Door')).toBe(true);
  });

  it('opens scene text so the scene and its document id come back', () => {
    const source = sceneDocumentRigCreate();
    source.api.invokeTool('add_portal', { name: 'Door', settings: { closed: true } });
    const document = sceneDocumentRead(source.api);
    const target = sceneDocumentRigCreate();
    expect(target.api.invokeTool('load_scene_document', { json: document.json }).ok).toBe(true);
    const portals = PortalOwner.collectUnder(target.world);
    expect(documentIdentityRead(target.world)).toBe(document.documentId);
    expect(portals.map((portal) => PortalOwner.settingsRead(portal)?.closed)).toEqual([true]);
  });

  it('fails on text that is not a scene document', () => {
    const rig = sceneDocumentRigCreate();
    expect(rig.api.invokeTool('load_scene_document', { json: '{"nope":1}' }).ok).toBe(false);
  });

  it('fails to load when the editor cannot open scene documents', () => {
    const api = new EditorApi(editorApiTestHostCreate().host);
    expect(api.invokeTool('load_scene_document', { json: '{}' }).ok).toBe(false);
  });
});
