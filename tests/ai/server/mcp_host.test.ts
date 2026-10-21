import { describe, expect, it } from 'vitest';
import { buildMcpUrl, McpHost, type McpServerFactory } from '@/ai/server/mcp_host.js';
import { MCP_DEFAULT_PORT } from '@/ai/shared/mcp_constants.js';

/**
 * Builds a server factory that refuses some ports and records every port it was
 * asked for.
 *
 * @param refusedPorts Ports that act as already taken.
 * @returns The factory and the ports it was asked for.
 */
function serverFactoryRecordingCreate(refusedPorts: ReadonlySet<number>): {
  factory: McpServerFactory;
  requestedPorts: number[];
} {
  const requestedPorts: number[] = [];
  const factory: McpServerFactory = (port) => {
    requestedPorts.push(port);
    if (refusedPorts.has(port)) {
      throw new Error('port in use');
    }
    return { stop: () => undefined, port };
  };
  return { factory, requestedPorts };
}

/** Invoker that answers every tool with success. */
const invokerSucceeding = async () => ({ ok: true, message: 'ok' });

/** Unit tests for the MCP host's port selection. */
describe('McpHost', () => {
  it('starts on the default port when no base port is given', () => {
    const recording = serverFactoryRecordingCreate(new Set());
    const result = new McpHost(recording.factory).start(invokerSucceeding);
    expect(result.status.port).toBe(MCP_DEFAULT_PORT);
  });

  it('starts on the requested base port and moves on when it is taken', () => {
    const basePort = MCP_DEFAULT_PORT + 40;
    const recording = serverFactoryRecordingCreate(new Set([basePort]));
    const result = new McpHost(recording.factory).start(invokerSucceeding, basePort);
    expect(recording.requestedPorts).toEqual([basePort, basePort + 1]);
    expect(result.ok).toBe(true);
    expect(result.status.url).toBe(buildMcpUrl(basePort + 1));
  });
});
