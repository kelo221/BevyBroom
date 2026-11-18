import { describe, expect, it } from 'vitest';
import { buildMcpInitializeResult } from '@/ai/server/mcp_initialize.js';
import { MCP_SERVER_INSTRUCTIONS } from '@/ai/shared/mcp_server_instructions.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

/** Proves every MCP client receives the level editing rules when it connects. */
describe('buildMcpInitializeResult', () => {
  it('sends the level editing rules as instructions', () => {
    expect(buildMcpInitializeResult().instructions).toBe(MCP_SERVER_INSTRUCTIONS);
  });

  it('states the minimum grid, the brushes-over-meshes rule and the ramp shape', () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain(String(GRID_INTERVAL_MINIMUM));
    expect(MCP_SERVER_INSTRUCTIONS).toContain('brushes');
    expect(MCP_SERVER_INSTRUCTIONS).toContain('ramp');
  });
});
