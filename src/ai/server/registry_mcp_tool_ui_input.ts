import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Tools that press keys, type text and read and click the open menus like a
 * user, so shortcuts, the command search and right-click menus behave exactly
 * as they do for a person.
 */
export const MCP_UI_INPUT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'keyboard_input',
    'Press a key or type text like a user, through real keyboard and input events on the element with keyboard focus (the editor itself when no field has focus). Give `code` to press and release one key with optional `keys`: `ctrl` is the primary shortcut modifier (Control, or Command on macOS), so {code: "KeyP", keys: {ctrl: true, shift: true}} opens the command search. Give `text` to type into the focused text field. Returns `focused` (tag and label of the focused element afterwards) and, for a key, `handled` (true when the editor used the key).',
    {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Keyboard event code, such as KeyP, Digit1, Enter, Escape or ArrowDown.' },
        text: { type: 'string', description: 'Text typed into the focused text field.' },
        keys: {
          type: 'object',
          description: 'Modifier keys held for the key press (all default false).',
          properties: {
            ctrl: { type: 'boolean', description: 'Primary shortcut modifier: Control, or Command on macOS.' },
            shift: { type: 'boolean' },
            alt: { type: 'boolean' },
          },
        },
      },
    },
  ),
  tool(
    'get_open_menus',
    'Read-only: the menus open on screen in document order: menu bar dropdowns and right-click menus (`kind` menu) and the command search (`kind` command_search, with the typed `query`). Each row has `label`, `shortcut` and `enabled`; command search rows also have their menu `path` and `active` (the row Enter runs). Right-click menus hide rows that do not apply.',
    emptySchema(),
  ),
  tool(
    'choose_open_menu_item',
    'Click the first enabled row with exactly this `label` in the open menus (see get_open_menus), like a user clicking it: the command runs and the menu closes. Returns the menus still open afterwards.',
    {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Row label as get_open_menus lists it.' },
      },
      required: ['label'],
    },
  ),
];
