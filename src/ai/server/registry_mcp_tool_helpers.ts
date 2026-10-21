import type { McpToolName } from '@/ai/shared/mcp_protocol_types.js';

/** JSON Schema-ish tool definition returned by tools/list. */
export interface McpToolDefinition {
  name: McpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** JSON Schema of an `{ x, y, z }` vector argument. */
export const vec3Schema = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
  },
  required: ['x', 'y', 'z'],
};

/**
 * Builds a tool definition entry.
 *
 * @param name Tool name.
 * @param description Tool description for AI clients.
 * @param inputSchema JSON Schema object.
 * @returns Tool definition.
 */
export function tool(name: McpToolName, description: string, inputSchema: Record<string, unknown>): McpToolDefinition {
  return { name, description, inputSchema };
}

/**
 * Empty object schema for tools without arguments.
 *
 * @returns JSON Schema object.
 */
export function emptySchema(): Record<string, unknown> {
  return { type: 'object', properties: {} };
}
