import { describe, expect, it } from 'vitest';
import {
  DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY,
  DESKTOP_MCP_AUTOSTART_URL_PREFIX,
  desktopMcpAutostartPortRead,
  desktopMcpAutostartRun,
} from '@/desktop/desktop_mcp_autostart.js';
import type { McpHostStartResult } from '@/ai/shared/mcp_protocol_types.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Builds a start result for a server bound to a port.
 *
 * @param port Bound port.
 * @returns Successful start result.
 */
function startResultListening(port: number): McpHostStartResult {
  const url = `http://127.0.0.1:${port}/mcp`;
  return { ok: true, message: `listening on ${url}`, status: { running: true, port, url } };
}

/** Unit tests for starting the MCP server at desktop launch. */
describe('desktop_mcp_autostart', () => {
  it('reads a valid port and ignores missing or invalid values', () => {
    expect(desktopMcpAutostartPortRead({ [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: ' 17777 ' })).toBe(17777);
    expect(desktopMcpAutostartPortRead({})).toBeNull();
    expect(desktopMcpAutostartPortRead({ [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: 'abc' })).toBeNull();
    expect(desktopMcpAutostartPortRead({ [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: '0' })).toBeNull();
    expect(desktopMcpAutostartPortRead({ [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: '70000' })).toBeNull();
  });

  it('does not start anything when autostart is not requested', () => {
    const lines: string[] = [];
    const result = desktopMcpAutostartRun({}, startResultListening, (line) => lines.push(line));
    expect(result).toBeNull();
    expect(lines).toEqual([]);
  });

  it('starts from the requested port and announces the bound URL', () => {
    const lines: string[] = [];
    const requestedPorts: number[] = [];
    const environment = { [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: '18888' };
    const result = desktopMcpAutostartRun(
      environment,
      (basePort) => {
        requestedPorts.push(basePort);
        return startResultListening(basePort + 1);
      },
      (line) => lines.push(line),
    );
    expect(requestedPorts).toEqual([18888]);
    expect(lines).toEqual([`${DESKTOP_MCP_AUTOSTART_URL_PREFIX}${result?.status.url}`]);
  });

  it('announces the failure message when the server cannot start', () => {
    const lines: string[] = [];
    const failed: McpHostStartResult = {
      ok: false,
      message: 'Could not bind a local MCP port',
      status: { running: false, port: null, url: null },
    };
    desktopMcpAutostartRun(
      { [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: '18888' },
      () => failed,
      (line) => lines.push(line),
    );
    expect(lines).toEqual([failed.message]);
  });

  it('starts the MCP server from the window ready handler of the desktop entry', () => {
    const bunEntry = readFileSync(resolve(process.cwd(), 'src/desktop/bun/index.ts'), 'utf8');
    const shownHandler = bunEntry.slice(bunEntry.indexOf('async function desktopWindowShownHandle'));
    expect(bunEntry).toContain('showMaximizedWhenReady(desktopWindow, desktopWindowShownHandle,');
    expect(shownHandler).toContain('desktopMcpAutostartRun(process.env');
  });
});
