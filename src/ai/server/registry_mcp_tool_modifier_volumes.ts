import { modifierVolumeTemplates } from '@/modifier/stack/modifier_volume_templates.js';
import { tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** JSON Schema of one modifier in a stack argument. */
const modifierStackEntrySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Existing modifier id to keep and update; omit for a new modifier.' },
    kind: { type: 'string', description: 'Modifier kind id (see list_modifier_kinds).' },
    name: { type: 'string', description: 'Card title; defaults to the kind label.' },
    enabled: { type: 'boolean', description: 'False mutes the modifier.' },
    parameters: {
      type: 'object',
      description: 'Kind parameters to set; unnamed parameters keep their current or default value.',
    },
  },
};

/** Stack-wide settings shared by the create and edit tools. */
const modifierStackSettingsProperties = {
  modifiers: {
    type: 'array',
    items: modifierStackEntrySchema,
    description: 'Ordered modifiers, evaluated first to last. Replaces the whole list when given.',
  },
  grouping: {
    type: 'string',
    enum: ['compound', 'brush'],
    description: 'compound captures whole top-level groups; brush captures single brushes.',
  },
  excludedIds: {
    type: 'array',
    items: { type: 'string' },
    description: 'Brush ids and group or solid model ids the volume ignores.',
  },
  enabled: { type: 'boolean', description: 'False disables the whole volume.' },
};

/** Tools that create, read, edit and bake modifier volumes. */
export const MCP_MODIFIER_VOLUME_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_modifier_kinds',
    'Lists the installed modifier kinds a modifier volume stack can hold, with their fields (key, type, default, choices, min, max) and the parameters a new modifier of that kind starts with, plus the Add menu templates. Returns { kinds, templates }.',
    { type: 'object', properties: {} },
  ),
  tool(
    'add_modifier_volume',
    'Creates a modifier volume as one undo step: an editor-only box whose ordered modifier stack (arrays, mirror, shear, bevel, smooth shading) turns the solid brushes it overlaps into extra or reshaped brushes in the result geometry, the export and the game preview. Starts from template (default empty), then applies the given stack settings. Returns { id, name, stack }.',
    {
      type: 'object',
      properties: {
        template: { type: 'string', enum: modifierVolumeTemplates.map((template) => template.id) },
        center: { ...vec3Schema, description: 'World center of the volume box.' },
        size: {
          ...vec3Schema,
          description: 'Box size in meters; every given edge must be positive. Default 1 x 1 x 1.',
        },
        parentId: {
          type: 'string',
          description: 'Id of the group, solid model or CSG group to parent the volume under. Default the world.',
        },
        name: { type: 'string', description: 'Object name; defaults to the template label.' },
        ...modifierStackSettingsProperties,
      },
      required: ['center'],
    },
  ),
  tool(
    'get_modifier_stack',
    'Reads the stack of a modifier volume: settings, every modifier with its normalized parameters, and the feedback of the last evaluation. Returns { id, name, stack, status }.',
    { type: 'object', properties: { id: { type: 'string', description: 'Modifier volume id.' } }, required: ['id'] },
  ),
  tool(
    'set_modifier_stack',
    'Edits the stack of a modifier volume as one undo step: replaces the modifier list (entries naming an existing id keep their other parameters), and sets grouping, excludedIds and enabled. Returns { id, name, stack }.',
    {
      type: 'object',
      properties: { id: { type: 'string', description: 'Modifier volume id.' }, ...modifierStackSettingsProperties },
      required: ['id'],
    },
  ),
  tool(
    'bake_modifier_volume',
    'Bakes a modifier volume into ordinary brushes as one undo step: generated copies become new brushes, reshaped brushes keep their shape, and the volume is removed. Returns { createdBrushIds }.',
    { type: 'object', properties: { id: { type: 'string', description: 'Modifier volume id.' } }, required: ['id'] },
  ),
];
