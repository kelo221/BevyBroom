import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { HandlerTextureReplace, type TextureReplaceScope } from '@/texture/replace/handler_texture_replace.js';

/** Runs the material replacement for automation. */
export class EditorApiTextureReplace {
  private readonly textureReplace: HandlerTextureReplace;

  /**
   * Creates the material replacement tool.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.textureReplace = new HandlerTextureReplace({
      commandStack: host.commandStack,
      worldObject: host.worldObject,
      selectionManager: host.selectionManager,
      afterReplace: () => host.refreshAfterWorldMutation(),
    });
  }

  /**
   * Runs the material replacement tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no replacement tool.
   */
  textureReplaceToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return name === 'replace_texture' ? this.textureReplaceApply(args) : null;
  }

  /**
   * Replaces one material with another on matching brush faces.
   *
   * @param args Tool arguments with findTextureId, replaceTextureId and scope.
   * @returns Result with the repainted face count.
   */
  private textureReplaceApply(args: Record<string, unknown>): McpToolResult {
    const findTextureId = args['findTextureId'];
    const replaceTextureId = args['replaceTextureId'];
    if (typeof findTextureId !== 'string' || typeof replaceTextureId !== 'string' || replaceTextureId === '') {
      return failResult('findTextureId and replaceTextureId must be non-empty strings');
    }
    const scope = this.scopeRead(args['scope']);
    if (scope === null) {
      return failResult('scope must be all or selection');
    }
    const faceCount = this.textureReplace.replace(findTextureId, replaceTextureId, scope);
    return okResult(`Replaced the material of ${faceCount} face(s)`, { faceCount, scope });
  }

  /**
   * Reads the scope argument.
   *
   * @param value Raw scope argument.
   * @returns Scope, all when omitted, or null when invalid.
   */
  private scopeRead(value: unknown): TextureReplaceScope | null {
    if (value === undefined || value === 'all') {
      return 'all';
    }
    return value === 'selection' ? 'selection' : null;
  }
}
