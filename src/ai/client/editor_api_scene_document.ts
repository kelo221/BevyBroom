import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';

/** Arguments of the load_scene_document tool. */
export interface SceneDocumentLoadArgs {
  json: string;
}

/**
 * Reads the open scene as scene file text and opens scene file text, without
 * file dialogs.
 */
export class EditorApiSceneDocument {
  private readonly host: EditorApiHost;
  private readonly sceneSerializer = new SceneSerializer();

  /**
   * Creates the scene document tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Returns the open scene exactly as Save would write it.
   *
   * @returns Result with the document id and the scene file text.
   */
  sceneDocumentRead(): McpToolResult {
    const scene = this.sceneSerializer.serialize(this.host.worldObject);
    const json = JSON.stringify(scene, null, 2);
    return okResult(`Scene document with ${scene.objects.length} objects`, { documentId: scene.documentId, json });
  }

  /**
   * Replaces the open scene with scene file text, as Load does.
   *
   * @param args Scene file text.
   * @returns Result naming whether the scene loaded.
   */
  sceneDocumentLoad(args: SceneDocumentLoadArgs): McpToolResult {
    const load = this.host.sceneDocumentLoad;
    if (!load) {
      return failResult('Loading scene documents is not available in this editor');
    }
    if (typeof args.json !== 'string' || !load(args.json)) {
      return failResult('The scene document could not be loaded');
    }
    return okResult('Scene document loaded');
  }
}
