import type { McpHostStartResult } from '@/ai/shared/mcp_protocol_types.js';

/**
 * Environment variable that starts the MCP server at launch, on this port or
 * the next free one.
 */
export const DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY = 'BEVYBROOM_MCP_AUTOSTART_PORT';

/** Prefix of the stdout line that announces the autostarted MCP server URL. */
export const DESKTOP_MCP_AUTOSTART_URL_PREFIX = 'BEVYBROOM_MCP_URL=';

/**
 * Reads the requested MCP autostart port from the environment.
 *
 * @param environment Process environment.
 * @returns The port, or null when autostart is not requested or the value is
 *   not a port.
 */
export function desktopMcpAutostartPortRead(environment: Record<string, string | undefined>): number | null {
  const text = environment[DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]?.trim() ?? '';
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const port = Number(text);
  return port >= 1 && port <= 65535 ? port : null;
}

/**
 * Starts the MCP server when the environment asks for it and announces its URL
 * on one stdout line, so a test harness can find it.
 *
 * @param environment Process environment.
 * @param start Starts the MCP server searching from a base port.
 * @param announce Writes one line of output.
 * @returns The start result, or null when autostart was not requested.
 */
export function desktopMcpAutostartRun(
  environment: Record<string, string | undefined>,
  start: (basePort: number) => McpHostStartResult,
  announce: (line: string) => void,
): McpHostStartResult | null {
  const port = desktopMcpAutostartPortRead(environment);
  if (port === null) {
    return null;
  }
  const result = start(port);
  announce(result.ok && result.status.url ? `${DESKTOP_MCP_AUTOSTART_URL_PREFIX}${result.status.url}` : result.message);
  return result;
}
