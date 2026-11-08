import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';

/** One texture of a texture_browser_entries reply. */
interface EditorApiTextureBrowserEntry {
  id: string;
  displayName: string;
  source: string;
}

/** Reads what the Texture Browser lists. */
export class EditorApiTextureBrowser {
  /**
   * Runs a texture browser tool.
   *
   * @param name Tool name.
   * @returns Tool result, or null when the name is no texture browser tool.
   */
  textureBrowserToolDispatch(name: string): McpToolResult | null {
    return name === 'texture_browser_entries' ? this.entriesRead() : null;
  }

  /**
   * Lists every texture of the shared texture library.
   *
   * @returns Result with the entries, or a failure while no library exists.
   */
  private entriesRead(): McpToolResult {
    const library = getTextureMapCache().getLibrary();
    if (library === null) {
      return failResult('The texture browser is not ready');
    }
    const entries: EditorApiTextureBrowserEntry[] = library.getEntries().map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      source: entry.sourceName,
    }));
    return okResult(`${entries.length} texture(s)`, { entries });
  }
}
