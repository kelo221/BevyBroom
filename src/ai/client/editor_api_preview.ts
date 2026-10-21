import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { PreviewLinkService } from '@/preview/link/preview_link_service.js';

/** Arguments of the preview_connect tool. */
export interface PreviewConnectArgs {
  endpoint?: string;
}

/**
 * Connects the editor to a running game preview and reports what the game
 * shows.
 */
export class EditorApiPreview {
  private readonly host: EditorApiHost;

  /**
   * Creates the preview tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Connects to the game preview, remembering the endpoint first when given.
   *
   * @param args Optional bridge endpoint URL.
   * @returns Result naming the endpoint in use.
   */
  previewConnect(args: PreviewConnectArgs): McpToolResult {
    const service = this.serviceRead();
    if (!service) {
      return failResult('The game preview is not available in this editor');
    }
    if (args.endpoint !== undefined) {
      service.endpointWrite(args.endpoint);
    }
    service.connect();
    return okResult(`Connecting to ${service.endpointRead()}`, { endpoint: service.endpointRead() });
  }

  /**
   * Reports the link state, the revisions this editor sent and the newest
   * status the game returned.
   *
   * @returns Result with the connection state, revisions, game status and last
   *   error.
   */
  previewStatus(): McpToolResult {
    const controller = this.serviceRead()?.controllerRead() ?? null;
    if (!controller) {
      return okResult('Not connected', { connection: 'disconnected', revisions: null, game: null, lastError: '' });
    }
    const data = {
      connection: controller.connectionStateRead(),
      revisions: controller.revisionsRead(),
      game: controller.gameStatusRead(),
      lastError: controller.lastErrorRead(),
    };
    return okResult(`Preview ${data.connection}`, data);
  }

  /**
   * Returns the editor's preview link service.
   *
   * @returns The service, or null when the editor has no game preview.
   */
  private serviceRead(): PreviewLinkService | null {
    return this.host.previewLinkServiceEnsure?.() ?? null;
  }
}
