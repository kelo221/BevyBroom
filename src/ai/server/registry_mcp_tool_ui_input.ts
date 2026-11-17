import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Tools that press keys, type text, read and click the open menus and drag
 * Entity Browser tiles like a user, so shortcuts, the command search,
 * right-click menus and browser drops behave exactly as they do for a person.
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
  tool(
    'get_entity_browser_tiles',
    'Read-only: the tiles the Entity Browser shows, in display order, each with `id` (such as "prefab.shelf_row" or "lights.point"), `label`, `category` and `selected`. Empty while the Entity Browser is closed; open it with set_main_window {floatingWindows: {entity_browser: true}}.',
    emptySchema(),
  ),
  tool(
    'entity_browser_drag',
    'Drag an Entity Browser tile into a view like a user: press on the tile, move onto the view point where the world point `at` shows, and release. The kind is placed there the way a drop places it (a prefab rests on the surface under the point). Returns `selection` afterwards, which holds what was placed, and `dropPoint` (client x, y of the drop). The Entity Browser must be open and show the tile.',
    {
      type: 'object',
      properties: {
        tileId: { type: 'string', description: 'Tile id as get_entity_browser_tiles lists it.' },
        view: { type: 'string', enum: ['perspective', 'top', 'front', 'side'], description: 'View to drop into.' },
        at: {
          type: 'object',
          description: 'World point whose spot in the view is the drop point.',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          required: ['x', 'y', 'z'],
        },
      },
      required: ['tileId', 'view', 'at'],
    },
  ),
  tool(
    'outliner_click',
    'Click the outliner row of a brush (brushId), CSG group (groupId) or solid model (solidModelId) like a user. A plain click selects only that row; `shift` selects every shown row from the last plain or Ctrl click to this row, up or down; `ctrl` toggles the row. Returns `selection` afterwards and `pageSelectedText`, the page text left selected (empty when the click selected no text). The row must be shown: its parents expanded and the outliner visible.',
    {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'brushId, groupId or solidModelId of the row.' },
        shift: { type: 'boolean', description: 'Hold Shift: select the range from the last plain click.' },
        ctrl: { type: 'boolean', description: 'Hold Ctrl: toggle the row.' },
      },
      required: ['id'],
    },
  ),
];
