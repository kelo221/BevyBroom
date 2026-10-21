import type { McpImagePayload, McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/** Content block of an MCP tools/call reply. */
interface DesktopE2eMcpContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

/** JSON-RPC reply of the MCP server. */
interface DesktopE2eMcpReply {
  result?: { content?: DesktopE2eMcpContentBlock[]; isError?: boolean };
  error?: { message: string };
}

/**
 * Calls the editor's MCP tools over Streamable HTTP JSON-RPC, as an AI client
 * does.
 */
export class DesktopE2eMcpClient {
  private readonly url: string;
  private nextRequestIdentifier = 1;

  /**
   * Creates a client for one MCP endpoint.
   *
   * @param url MCP endpoint URL.
   */
  constructor(url: string) {
    this.url = url;
  }

  /**
   * Runs the MCP initialize handshake.
   *
   * @returns The server's initialize result.
   */
  async initialize(): Promise<unknown> {
    const reply = await this.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'bevybroom_desktop_e2e', version: '1' },
    });
    return reply.result;
  }

  /**
   * Calls one editor tool and returns the editor's tool result, with the
   * pictures the reply carried as image blocks.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns The editor's result envelope.
   */
  async toolCall(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const reply = await this.request('tools/call', { name, arguments: args });
    const content = reply.result?.content ?? [];
    const text = content.find((block) => block.type === 'text')?.text;
    if (text === undefined) {
      throw new Error(`Tool ${name} returned no text: ${JSON.stringify(reply)}`);
    }
    const images = this.imageBlocksRead(content);
    const result = JSON.parse(text) as McpToolResult;
    return images.length > 0 ? { ...result, images } : result;
  }

  /**
   * Collects the pictures of a reply's image blocks.
   *
   * @param content Reply content blocks.
   * @returns Pictures in reply order.
   */
  private imageBlocksRead(content: DesktopE2eMcpContentBlock[]): McpImagePayload[] {
    return content
      .filter((block) => block.type === 'image' && block.data !== undefined)
      .map((block): McpImagePayload => ({ mimeType: block.mimeType ?? '', data: block.data ?? '' }));
  }

  /**
   * Calls one editor tool and fails when the editor reports a failure.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns The successful result envelope.
   */
  async toolCallExpectOk(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const result = await this.toolCall(name, args);
    if (!result.ok) {
      throw new Error(`Tool ${name} failed: ${result.message}`);
    }
    return result;
  }

  /**
   * Sends one JSON-RPC request.
   *
   * @param method JSON-RPC method.
   * @param params Method parameters.
   * @returns The JSON-RPC reply.
   */
  private async request(method: string, params: Record<string, unknown>): Promise<DesktopE2eMcpReply> {
    const body = { jsonrpc: '2.0', id: this.nextRequestIdentifier++, method, params };
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        connection: 'close',
      },
      body: JSON.stringify(body),
    });
    const reply = (await response.json()) as DesktopE2eMcpReply;
    if (reply.error) {
      throw new Error(`MCP ${method} failed: ${reply.error.message}`);
    }
    return reply;
  }
}
